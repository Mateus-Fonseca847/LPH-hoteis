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

function getRangeDayCount(startDate: string, endDate: string) {
  return buildDateRange(startDate, endDate).length;
}

function getAvailabilityMonthLabel(startDate: string, endDate: string) {
  const startMonth = startDate.slice(0, 7);
  const endMonth = endDate.slice(0, 7);

  return startMonth === endMonth ? startMonth : `${startDate}..${endDate}`;
}

function getAvailabilityStats(
  rows: Array<{
    date: Date;
    closed: boolean;
    availableUnits: number;
  }>,
  startDate: string,
  endDate: string
) {
  const rangeDays = getRangeDayCount(startDate, endDate);
  const uniqueDates = new Set(rows.map((row) => row.date.toISOString().slice(0, 10)));

  return {
    recordsFound: rows.length,
    missingDays: Math.max(rangeDays - uniqueDates.size, 0),
    closedDays: rows.filter((row) => row.closed).length,
    zeroAvailableDays: rows.filter((row) => row.availableUnits === 0).length,
  };
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

function assertAvailabilityLimits(totalUnits: number, availableUnits: number, roomUnits: number) {
  if (totalUnits > roomUnits || availableUnits > roomUnits) {
    throw new ValidationError(
      "As unidades disponíveis não podem ser maiores que as unidades do quarto."
    );
  }

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
    const stats = getAvailabilityStats(
      availability,
      parsedPayload.data.startDate,
      parsedPayload.data.endDate
    );

    console.info("[availability/admin/load]", {
      hotelId: parsedParams.data.hotelId,
      roomId: room.id,
      roomName: room.name,
      month: getAvailabilityMonthLabel(parsedPayload.data.startDate, parsedPayload.data.endDate),
      ...stats,
    });

    return {
      status: "success" as const,
      message: "",
      availability: availability.map(formatAvailabilityRow),
    };
  } catch (error) {
    console.error("[availability/admin/load]", {
      hotelId,
      roomId,
      error: error instanceof Error ? error.message : "Unknown error",
    });

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
          room.units;
        const availableUnits =
          parsedPayload.data.availableUnits ?? existing?.availableUnits ?? totalUnits;
        const closed = parsedPayload.data.closed ?? existing?.closed ?? false;
        const note = parsedPayload.data.note ?? existing?.note ?? null;

        assertAvailabilityLimits(totalUnits, availableUnits, room.units);

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

    const savedAvailability = await prisma.roomAvailability.findMany({
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
      select: {
        date: true,
        closed: true,
        availableUnits: true,
      },
    });

    console.info("[availability/admin/save]", {
      hotelId: hotel.id,
      roomId: room.id,
      roomName: room.name,
      month: getAvailabilityMonthLabel(parsedPayload.data.startDate, parsedPayload.data.endDate),
      ...getAvailabilityStats(
        savedAvailability,
        parsedPayload.data.startDate,
        parsedPayload.data.endDate
      ),
    });

    revalidateRoomAvailabilityPaths(hotel.id, hotel.slug);

    return {
      status: "success",
      message: "Disponibilidade salva com sucesso.",
    };
  } catch (error) {
    console.error("[availability/admin/save]", {
      hotelId,
      roomId,
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return {
      status: "error",
      message: getErrorMessage(error, "Não foi possível salvar a disponibilidade."),
    };
  }
}
