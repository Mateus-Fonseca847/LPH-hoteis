"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { createHotelRoomAuditLog, type HotelRoomAuditSnapshot } from "@/lib/audit/hotel-room-audit";
import { getErrorMessage, NotFoundError, ValidationError } from "@/lib/errors/app-error";
import {
  getRequestIpAddress,
  parseHotelRouteParams,
  parseHotelRoomRouteParams,
  requireAuthorizedHotelWrite,
} from "@/lib/hotel-write";
import { prisma } from "@/lib/prisma";
import { parseCreateHotelRoomPayload, parseUpdateHotelRoomPayload } from "@/lib/validations/room";

export type HotelRoomActionState = {
  status: "idle" | "success" | "error";
  message: string;
  roomId?: string;
};

export type AuthorizedHotelRoom = {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  capacityAdults: number;
  capacityChildren: number;
  beds: string;
  sizeM2: number | null;
  amenities: string[];
  isActive: boolean;
  capacity: number;
  size: string;
  priceFrom: string;
  isAvailable: boolean;
};

function mapRoomSnapshot(room: {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  capacityAdults: number;
  capacityChildren: number;
  beds: string;
  sizeM2: number | null;
  amenities: string[];
  isActive: boolean;
  capacity: number;
  size: string;
  priceFrom: { toString(): string };
  isAvailable: boolean;
}): HotelRoomAuditSnapshot {
  return {
    id: room.id,
    name: room.name,
    description: room.description,
    imageUrl: room.imageUrl,
    capacityAdults: room.capacityAdults,
    capacityChildren: room.capacityChildren,
    beds: room.beds,
    sizeM2: room.sizeM2,
    amenities: room.amenities,
    isActive: room.isActive,
    capacity: room.capacity,
    size: room.size,
    priceFrom: room.priceFrom.toString(),
    isAvailable: room.isAvailable,
  };
}

function formatRoomForList(room: {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  capacityAdults: number;
  capacityChildren: number;
  beds: string;
  sizeM2: number | null;
  amenities: string[];
  isActive: boolean;
  capacity: number;
  size: string;
  priceFrom: { toString(): string };
  isAvailable: boolean;
}) {
  return {
    id: room.id,
    name: room.name,
    description: room.description,
    imageUrl: room.imageUrl,
    capacityAdults: room.capacityAdults,
    capacityChildren: room.capacityChildren,
    beds: room.beds,
    sizeM2: room.sizeM2,
    amenities: room.amenities,
    isActive: room.isActive,
    capacity: room.capacity,
    size: room.size,
    priceFrom: room.priceFrom.toString(),
    isAvailable: room.isAvailable,
  } satisfies AuthorizedHotelRoom;
}

function buildRoomDerivedData(payload: {
  capacityAdults: number;
  capacityChildren: number;
  sizeM2: number;
  isActive: boolean;
}) {
  return {
    capacity: payload.capacityAdults + payload.capacityChildren,
    size: `${payload.sizeM2} m²`,
    isAvailable: payload.isActive,
  };
}

async function getAuthorizedHotelContext(hotelId: string) {
  const user = await requireAuthorizedHotelWrite(hotelId);
  const hotel = await prisma.hotel.findUnique({
    where: {
      id: hotelId,
    },
    select: {
      id: true,
      slug: true,
      name: true,
    },
  });

  if (!hotel) {
    throw new NotFoundError("Hotel não encontrado.");
  }

  return {
    user,
    hotel,
  };
}

async function getAuthorizedRoomContext(hotelId: string, roomId: string) {
  const { user, hotel } = await getAuthorizedHotelContext(hotelId);
  const room = await prisma.hotelRoom.findFirst({
    where: {
      id: roomId,
      hotelId,
    },
  });

  if (!room) {
    throw new NotFoundError("Quarto não encontrado.");
  }

  return {
    user,
    hotel,
    room,
  };
}

async function getAuditIpAddress() {
  const requestHeaders = await headers();
  return getRequestIpAddress(requestHeaders);
}

function revalidateHotelRoomPaths(hotelId: string, hotelSlug: string) {
  revalidatePath("/admin/hoteis");
  revalidatePath(`/admin/hoteis/${hotelId}`);
  revalidatePath("/");
  revalidatePath(`/hoteis/${hotelSlug}`);
}

export async function listHotelRoomsAction(hotelId: string) {
  try {
    const parsedParams = parseHotelRouteParams({ hotelId });

    if (!parsedParams.success) {
      throw new ValidationError(parsedParams.error.issues[0]?.message || "Identificador inválido.");
    }

    await getAuthorizedHotelContext(parsedParams.data.hotelId);

    const rooms = await prisma.hotelRoom.findMany({
      where: {
        hotelId: parsedParams.data.hotelId,
      },
      orderBy: [{ createdAt: "asc" }, { name: "asc" }],
    });

    return {
      status: "success" as const,
      message: "",
      rooms: rooms.map(formatRoomForList),
    };
  } catch (error) {
    return {
      status: "error" as const,
      message: getErrorMessage(error, "Não foi possível listar os quartos."),
      rooms: [] as AuthorizedHotelRoom[],
    };
  }
}

export async function createHotelRoomAction(
  hotelId: string,
  payload: unknown
): Promise<HotelRoomActionState> {
  try {
    const parsedParams = parseHotelRouteParams({ hotelId });

    if (!parsedParams.success) {
      throw new ValidationError(parsedParams.error.issues[0]?.message || "Identificador inválido.");
    }

    const { user, hotel } = await getAuthorizedHotelContext(parsedParams.data.hotelId);
    const parsedPayload = parseCreateHotelRoomPayload(payload);

    if (!parsedPayload.success) {
      throw new ValidationError(parsedPayload.error);
    }

    const roomPayload = parsedPayload.data;
    const derived = buildRoomDerivedData(roomPayload);
    const ipAddress = await getAuditIpAddress();

    const createdRoom = await prisma.$transaction(async (tx) => {
      const room = await tx.hotelRoom.create({
        data: {
          hotelId: hotel.id,
          name: roomPayload.name,
          description: roomPayload.description,
          imageUrl: roomPayload.imageUrl,
          capacityAdults: roomPayload.capacityAdults,
          capacityChildren: roomPayload.capacityChildren,
          beds: roomPayload.beds,
          sizeM2: roomPayload.sizeM2,
          amenities: roomPayload.amenities,
          isActive: roomPayload.isActive,
          capacity: derived.capacity,
          size: derived.size,
          priceFrom: new Prisma.Decimal(0),
          isAvailable: derived.isAvailable,
        },
      });

      await createHotelRoomAuditLog({
        tx,
        userId: user.id,
        hotelId: hotel.id,
        action: "hotel.room.created",
        previousValue: null,
        newValue: mapRoomSnapshot(room),
        ipAddress,
      });

      return room;
    });

    revalidateHotelRoomPaths(hotel.id, hotel.slug);

    return {
      status: "success",
      message: "Quarto criado com sucesso.",
      roomId: createdRoom.id,
    };
  } catch (error) {
    return {
      status: "error",
      message: getErrorMessage(error, "Não foi possível criar o quarto."),
    };
  }
}

export async function updateHotelRoomAction(
  hotelId: string,
  roomId: string,
  payload: unknown
): Promise<HotelRoomActionState> {
  try {
    const parsedParams = parseHotelRoomRouteParams({ hotelId, roomId });

    if (!parsedParams.success) {
      throw new ValidationError(parsedParams.error.issues[0]?.message || "Identificador inválido.");
    }

    const { user, hotel, room } = await getAuthorizedRoomContext(
      parsedParams.data.hotelId,
      parsedParams.data.roomId
    );
    const parsedPayload = parseUpdateHotelRoomPayload(payload);

    if (!parsedPayload.success) {
      throw new ValidationError(parsedPayload.error);
    }

    const roomPayload = parsedPayload.data;
    const nextCapacityAdults = roomPayload.capacityAdults ?? room.capacityAdults;
    const nextCapacityChildren = roomPayload.capacityChildren ?? room.capacityChildren;
    const nextSizeM2 = roomPayload.sizeM2 ?? room.sizeM2 ?? 1;
    const nextIsActive = roomPayload.isActive ?? room.isActive;
    const derived = buildRoomDerivedData({
      capacityAdults: nextCapacityAdults,
      capacityChildren: nextCapacityChildren,
      sizeM2: nextSizeM2,
      isActive: nextIsActive,
    });
    const previousValue = mapRoomSnapshot(room);
    const ipAddress = await getAuditIpAddress();

    const updatedRoom = await prisma.$transaction(async (tx) => {
      const roomRecord = await tx.hotelRoom.update({
        where: {
          id: room.id,
        },
        data: {
          name: roomPayload.name ?? room.name,
          description: roomPayload.description ?? room.description,
          imageUrl: roomPayload.imageUrl ?? room.imageUrl,
          capacityAdults: nextCapacityAdults,
          capacityChildren: nextCapacityChildren,
          beds: roomPayload.beds ?? room.beds,
          sizeM2: roomPayload.sizeM2 ?? room.sizeM2,
          amenities: roomPayload.amenities ?? room.amenities,
          isActive: nextIsActive,
          capacity: derived.capacity,
          size: derived.size,
          isAvailable: derived.isAvailable,
        },
      });

      await createHotelRoomAuditLog({
        tx,
        userId: user.id,
        hotelId: hotel.id,
        action: "hotel.room.updated",
        previousValue,
        newValue: mapRoomSnapshot(roomRecord),
        ipAddress,
      });

      return roomRecord;
    });

    revalidateHotelRoomPaths(hotel.id, hotel.slug);

    return {
      status: "success",
      message: "Quarto atualizado com sucesso.",
      roomId: updatedRoom.id,
    };
  } catch (error) {
    return {
      status: "error",
      message: getErrorMessage(error, "Não foi possível atualizar o quarto."),
    };
  }
}

export async function toggleHotelRoomActiveAction(
  hotelId: string,
  roomId: string,
  isActive: boolean
): Promise<HotelRoomActionState> {
  try {
    const parsedParams = parseHotelRoomRouteParams({ hotelId, roomId });

    if (!parsedParams.success) {
      throw new ValidationError(parsedParams.error.issues[0]?.message || "Identificador inválido.");
    }

    if (typeof isActive !== "boolean") {
      throw new ValidationError("Status de ativação inválido.");
    }

    const { user, hotel, room } = await getAuthorizedRoomContext(
      parsedParams.data.hotelId,
      parsedParams.data.roomId
    );
    const previousValue = mapRoomSnapshot(room);
    const ipAddress = await getAuditIpAddress();

    const updatedRoom = await prisma.$transaction(async (tx) => {
      const roomRecord = await tx.hotelRoom.update({
        where: {
          id: room.id,
        },
        data: {
          isActive,
          isAvailable: isActive,
        },
      });

      await createHotelRoomAuditLog({
        tx,
        userId: user.id,
        hotelId: hotel.id,
        action: isActive ? "hotel.room.activated" : "hotel.room.deactivated",
        previousValue,
        newValue: mapRoomSnapshot(roomRecord),
        ipAddress,
      });

      return roomRecord;
    });

    revalidateHotelRoomPaths(hotel.id, hotel.slug);

    return {
      status: "success",
      message: isActive ? "Quarto ativado com sucesso." : "Quarto desativado com sucesso.",
      roomId: updatedRoom.id,
    };
  } catch (error) {
    return {
      status: "error",
      message: getErrorMessage(error, "Não foi possível alterar o status do quarto."),
    };
  }
}
