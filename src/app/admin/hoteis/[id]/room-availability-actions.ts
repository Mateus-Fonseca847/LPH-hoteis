"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import {
  createRoomAvailabilityAuditLog,
  type RoomAvailabilityAuditEntry,
} from "@/lib/audit/room-availability-audit";
import { getErrorMessage, NotFoundError, ValidationError } from "@/lib/errors/app-error";
import {
  getRequestIpAddress,
  parseHotelRoomRouteParams,
  requireAuthorizedHotelWrite,
} from "@/lib/hotel-write";
import { prisma } from "@/lib/prisma";
import {
  parseBulkRoomAvailabilityPayload,
  parseRoomAvailabilityIntervalPayload,
} from "@/lib/validations/room-availability";

export type AuthorizedRoomAvailability = {
  id: string;
  roomId: string;
  date: string;
  totalUnits: number;
  availableUnits: number;
  closed: boolean;
  note: string | null;
};

export type RoomAvailabilityActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

function toUtcDateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function formatAvailabilityRow(row: {
  id: string;
  roomId: string;
  date: Date;
  totalUnits: number;
  availableUnits: number;
  closed: boolean;
  note: string | null;
}) {
  return {
    id: row.id,
    roomId: row.roomId,
    date: row.date.toISOString().slice(0, 10),
    totalUnits: row.totalUnits,
    availableUnits: row.availableUnits,
    closed: row.closed,
    note: row.note,
  } satisfies AuthorizedRoomAvailability;
}

function mapAuditEntry(row: {
  id?: string;
  roomId: string;
  date: Date;
  totalUnits: number;
  availableUnits: number;
  closed: boolean;
  note: string | null;
}): RoomAvailabilityAuditEntry {
  return {
    id: row.id,
    roomId: row.roomId,
    date: row.date.toISOString().slice(0, 10),
    totalUnits: row.totalUnits,
    availableUnits: row.availableUnits,
    closed: row.closed,
    note: row.note,
  };
}

function buildDateRange(startDate: string, endDate: string) {
  const dates: Date[] = [];
  const current = toUtcDateOnly(startDate);
  const end = toUtcDateOnly(endDate);

  while (current.getTime() <= end.getTime()) {
    dates.push(new Date(current));
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return dates;
}

async function getAuditIpAddress() {
  const requestHeaders = await headers();
  return getRequestIpAddress(requestHeaders);
}

function revalidateRoomAvailabilityPaths(hotelId: string, hotelSlug: string) {
  revalidatePath("/admin/hoteis");
  revalidatePath(`/admin/hoteis/${hotelId}`);
  revalidatePath("/");
  revalidatePath(`/hoteis/${hotelSlug}`);
}

async function getAuthorizedRoomContext(hotelId: string, roomId: string) {
  const user = await requireAuthorizedHotelWrite(hotelId);
  const room = await prisma.hotelRoom.findFirst({
    where: {
      id: roomId,
      hotelId,
    },
    include: {
      hotel: {
        select: {
          id: true,
          slug: true,
          name: true,
        },
      },
    },
  });

  if (!room) {
    throw new NotFoundError("Quarto não encontrado.");
  }

  return {
    user,
    hotel: room.hotel,
    room,
  };
}

function assertAvailabilityLimits(totalUnits: number, availableUnits: number) {
  if (availableUnits > totalUnits) {
    throw new ValidationError(
      "Unidades disponíveis não podem ser maiores que o total de unidades."
    );
  }
}

export async function listRoomAvailabilityAction(
  hotelId: string,
  roomId: string,
  payload: unknown
) {
  try {
    const parsedParams = parseHotelRoomRouteParams({ hotelId, roomId });

    if (!parsedParams.success) {
      throw new ValidationError(parsedParams.error.issues[0]?.message || "Identificador inválido.");
    }

    const { room } = await getAuthorizedRoomContext(
      parsedParams.data.hotelId,
      parsedParams.data.roomId
    );
    const parsedPayload = parseRoomAvailabilityIntervalPayload(payload);

    if (!parsedPayload.success) {
      throw new ValidationError(parsedPayload.error);
    }

    if (parsedPayload.data.roomId !== room.id) {
      throw new ValidationError("Quarto inválido para esta disponibilidade.");
    }

    const availability = await prisma.roomAvailability.findMany({
      where: {
        roomId: room.id,
        date: {
          gte: toUtcDateOnly(parsedPayload.data.startDate),
          lte: toUtcDateOnly(parsedPayload.data.endDate),
        },
      },
      orderBy: {
        date: "asc",
      },
    });

    return {
      status: "success" as const,
      message: "",
      availability: availability.map(formatAvailabilityRow),
    };
  } catch (error) {
    return {
      status: "error" as const,
      message: getErrorMessage(error, "Não foi possível carregar a disponibilidade."),
      availability: [] as AuthorizedRoomAvailability[],
    };
  }
}

export async function saveRoomAvailabilityRangeAction(
  hotelId: string,
  roomId: string,
  payload: unknown
): Promise<RoomAvailabilityActionState> {
  try {
    const parsedParams = parseHotelRoomRouteParams({ hotelId, roomId });

    if (!parsedParams.success) {
      throw new ValidationError(parsedParams.error.issues[0]?.message || "Identificador inválido.");
    }

    const { user, hotel, room } = await getAuthorizedRoomContext(
      parsedParams.data.hotelId,
      parsedParams.data.roomId
    );
    const parsedPayload = parseBulkRoomAvailabilityPayload(payload);

    if (!parsedPayload.success) {
      throw new ValidationError(parsedPayload.error);
    }

    if (parsedPayload.data.roomId !== room.id) {
      throw new ValidationError("Quarto inválido para esta disponibilidade.");
    }

    const dates = buildDateRange(parsedPayload.data.startDate, parsedPayload.data.endDate);
    const ipAddress = await getAuditIpAddress();

    await prisma.$transaction(async (tx) => {
      const existingRows = await tx.roomAvailability.findMany({
        where: {
          roomId: room.id,
          date: {
            gte: dates[0],
            lte: dates[dates.length - 1],
          },
        },
        orderBy: {
          date: "asc",
        },
      });

      const existingByDate = new Map(
        existingRows.map((row) => [row.date.toISOString().slice(0, 10), row])
      );
      const previousEntries: RoomAvailabilityAuditEntry[] = [];
      const nextEntries: RoomAvailabilityAuditEntry[] = [];

      for (const date of dates) {
        const dateKey = date.toISOString().slice(0, 10);
        const existing = existingByDate.get(dateKey);
        const totalUnits =
          parsedPayload.data.totalUnits ??
          existing?.totalUnits ??
          parsedPayload.data.availableUnits ??
          0;
        const availableUnits =
          parsedPayload.data.availableUnits ?? existing?.availableUnits ?? totalUnits;
        const closed = parsedPayload.data.closed ?? existing?.closed ?? false;
        const note = parsedPayload.data.note ?? existing?.note ?? null;

        assertAvailabilityLimits(totalUnits, availableUnits);

        const row = await tx.roomAvailability.upsert({
          where: {
            roomId_date: {
              roomId: room.id,
              date,
            },
          },
          create: {
            roomId: room.id,
            date,
            totalUnits,
            availableUnits,
            closed,
            note,
          },
          update: {
            totalUnits,
            availableUnits,
            closed,
            note,
          },
        });

        if (existing) {
          previousEntries.push(mapAuditEntry(existing));
        }

        nextEntries.push(mapAuditEntry(row));
      }

      await createRoomAvailabilityAuditLog({
        tx,
        userId: user.id,
        hotelId: hotel.id,
        action: "hotel.room_availability.bulk_upserted",
        previousValue: previousEntries,
        newValue: nextEntries,
        ipAddress,
      });
    });

    revalidateRoomAvailabilityPaths(hotel.id, hotel.slug);

    return {
      status: "success",
      message: "Disponibilidade salva com sucesso.",
    };
  } catch (error) {
    return {
      status: "error",
      message: getErrorMessage(error, "Não foi possível salvar a disponibilidade."),
    };
  }
}
