"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { createRoomRateAuditLog, type RoomRateAuditSnapshot } from "@/lib/audit/room-rate-audit";
import { getErrorMessage, NotFoundError, ValidationError } from "@/lib/errors/app-error";
import {
  getRequestIpAddress,
  parseHotelRoomRateRouteParams,
  parseHotelRoomRouteParams,
  requireAuthorizedHotelWrite,
} from "@/lib/hotel-write";
import { prisma } from "@/lib/prisma";
import {
  parseCreateRoomRatePayload,
  parseUpdateRoomRatePayload,
} from "@/lib/validations/room-rate";

export type RoomRateActionState = {
  status: "idle" | "success" | "error";
  message: string;
  rateId?: string;
};

export type AuthorizedRoomRate = {
  id: string;
  roomId: string;
  name: string;
  description: string;
  priceCents: number;
  currency: string;
  startDate: string;
  endDate: string;
  minNights: number;
  maxGuests: number;
  refundable: boolean;
  breakfastIncluded: boolean;
  isActive: boolean;
};

function mapRateSnapshot(rate: {
  id: string;
  roomId: string;
  name: string;
  description: string;
  priceCents: number;
  currency: string;
  startDate: Date;
  endDate: Date;
  minNights: number;
  maxGuests: number;
  refundable: boolean;
  breakfastIncluded: boolean;
  isActive: boolean;
}): RoomRateAuditSnapshot {
  return {
    id: rate.id,
    roomId: rate.roomId,
    name: rate.name,
    description: rate.description,
    priceCents: rate.priceCents,
    currency: rate.currency,
    startDate: rate.startDate.toISOString(),
    endDate: rate.endDate.toISOString(),
    minNights: rate.minNights,
    maxGuests: rate.maxGuests,
    refundable: rate.refundable,
    breakfastIncluded: rate.breakfastIncluded,
    isActive: rate.isActive,
  };
}

function formatRateForList(rate: {
  id: string;
  roomId: string;
  name: string;
  description: string;
  priceCents: number;
  currency: string;
  startDate: Date;
  endDate: Date;
  minNights: number;
  maxGuests: number;
  refundable: boolean;
  breakfastIncluded: boolean;
  isActive: boolean;
}) {
  return {
    id: rate.id,
    roomId: rate.roomId,
    name: rate.name,
    description: rate.description,
    priceCents: rate.priceCents,
    currency: rate.currency,
    startDate: rate.startDate.toISOString(),
    endDate: rate.endDate.toISOString(),
    minNights: rate.minNights,
    maxGuests: rate.maxGuests,
    refundable: rate.refundable,
    breakfastIncluded: rate.breakfastIncluded,
    isActive: rate.isActive,
  } satisfies AuthorizedRoomRate;
}

async function getAuditIpAddress() {
  const requestHeaders = await headers();
  return getRequestIpAddress(requestHeaders);
}

function revalidateRoomRatePaths(hotelId: string, hotelSlug: string) {
  revalidatePath("/admin/hoteis");
  revalidatePath(`/admin/hoteis/${hotelId}`);
  revalidatePath("/");
  revalidatePath(`/hoteis/${hotelSlug}`);
}

function assertRateDateRange(startDate: Date, endDate: Date) {
  if (endDate.getTime() < startDate.getTime()) {
    throw new ValidationError("A data final não pode ser anterior à data inicial.");
  }
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

async function getAuthorizedRateContext(hotelId: string, roomId: string, rateId: string) {
  const { user, hotel, room } = await getAuthorizedRoomContext(hotelId, roomId);
  const rate = await prisma.roomRate.findFirst({
    where: {
      id: rateId,
      roomId: room.id,
    },
  });

  if (!rate) {
    throw new NotFoundError("Tarifa não encontrada.");
  }

  return {
    user,
    hotel,
    room,
    rate,
  };
}

export async function listRoomRatesAction(hotelId: string, roomId: string) {
  try {
    const parsedParams = parseHotelRoomRouteParams({ hotelId, roomId });

    if (!parsedParams.success) {
      throw new ValidationError(parsedParams.error.issues[0]?.message || "Identificador inválido.");
    }

    const { room } = await getAuthorizedRoomContext(
      parsedParams.data.hotelId,
      parsedParams.data.roomId
    );

    const rates = await prisma.roomRate.findMany({
      where: {
        roomId: room.id,
      },
      orderBy: [{ startDate: "asc" }, { createdAt: "asc" }],
    });

    return {
      status: "success" as const,
      message: "",
      rates: rates.map(formatRateForList),
    };
  } catch (error) {
    return {
      status: "error" as const,
      message: getErrorMessage(error, "Não foi possível listar as tarifas."),
      rates: [] as AuthorizedRoomRate[],
    };
  }
}

export async function createRoomRateAction(
  hotelId: string,
  roomId: string,
  payload: unknown
): Promise<RoomRateActionState> {
  try {
    const parsedParams = parseHotelRoomRouteParams({ hotelId, roomId });

    if (!parsedParams.success) {
      throw new ValidationError(parsedParams.error.issues[0]?.message || "Identificador inválido.");
    }

    const { user, hotel, room } = await getAuthorizedRoomContext(
      parsedParams.data.hotelId,
      parsedParams.data.roomId
    );
    const parsedPayload = parseCreateRoomRatePayload(payload);

    if (!parsedPayload.success) {
      throw new ValidationError(parsedPayload.error);
    }

    if (parsedPayload.data.roomId !== room.id) {
      throw new ValidationError("Quarto inválido para esta tarifa.");
    }

    const ratePayload = parsedPayload.data;
    const startDate = new Date(ratePayload.startDate);
    const endDate = new Date(ratePayload.endDate);
    assertRateDateRange(startDate, endDate);
    const ipAddress = await getAuditIpAddress();

    const createdRate = await prisma.$transaction(async (tx) => {
      const rate = await tx.roomRate.create({
        data: {
          roomId: room.id,
          name: ratePayload.name,
          description: ratePayload.description,
          priceCents: ratePayload.priceCents,
          currency: ratePayload.currency,
          startDate,
          endDate,
          minNights: ratePayload.minNights,
          maxGuests: ratePayload.maxGuests,
          refundable: ratePayload.refundable,
          breakfastIncluded: ratePayload.breakfastIncluded,
          isActive: ratePayload.isActive,
        },
      });

      await createRoomRateAuditLog({
        tx,
        userId: user.id,
        hotelId: hotel.id,
        action: "hotel.room_rate.created",
        previousValue: null,
        newValue: mapRateSnapshot(rate),
        ipAddress,
      });

      return rate;
    });

    revalidateRoomRatePaths(hotel.id, hotel.slug);

    return {
      status: "success",
      message: "Tarifa criada com sucesso.",
      rateId: createdRate.id,
    };
  } catch (error) {
    return {
      status: "error",
      message: getErrorMessage(error, "Não foi possível criar a tarifa."),
    };
  }
}

export async function updateRoomRateAction(
  hotelId: string,
  roomId: string,
  rateId: string,
  payload: unknown
): Promise<RoomRateActionState> {
  try {
    const parsedParams = parseHotelRoomRateRouteParams({ hotelId, roomId, rateId });

    if (!parsedParams.success) {
      throw new ValidationError(parsedParams.error.issues[0]?.message || "Identificador inválido.");
    }

    const { user, hotel, room, rate } = await getAuthorizedRateContext(
      parsedParams.data.hotelId,
      parsedParams.data.roomId,
      parsedParams.data.rateId
    );
    const parsedPayload = parseUpdateRoomRatePayload(payload);

    if (!parsedPayload.success) {
      throw new ValidationError(parsedPayload.error);
    }

    if (parsedPayload.data.roomId && parsedPayload.data.roomId !== room.id) {
      throw new ValidationError("Quarto inválido para esta tarifa.");
    }

    const ratePayload = parsedPayload.data;
    const previousValue = mapRateSnapshot(rate);
    const nextStartDate = ratePayload.startDate ? new Date(ratePayload.startDate) : rate.startDate;
    const nextEndDate = ratePayload.endDate ? new Date(ratePayload.endDate) : rate.endDate;
    assertRateDateRange(nextStartDate, nextEndDate);
    const ipAddress = await getAuditIpAddress();

    const updatedRate = await prisma.$transaction(async (tx) => {
      const rateRecord = await tx.roomRate.update({
        where: {
          id: rate.id,
        },
        data: {
          name: ratePayload.name ?? rate.name,
          description: ratePayload.description ?? rate.description,
          priceCents: ratePayload.priceCents ?? rate.priceCents,
          currency: ratePayload.currency ?? rate.currency,
          startDate: nextStartDate,
          endDate: nextEndDate,
          minNights: ratePayload.minNights ?? rate.minNights,
          maxGuests: ratePayload.maxGuests ?? rate.maxGuests,
          refundable: ratePayload.refundable ?? rate.refundable,
          breakfastIncluded: ratePayload.breakfastIncluded ?? rate.breakfastIncluded,
          isActive: ratePayload.isActive ?? rate.isActive,
        },
      });

      await createRoomRateAuditLog({
        tx,
        userId: user.id,
        hotelId: hotel.id,
        action: "hotel.room_rate.updated",
        previousValue,
        newValue: mapRateSnapshot(rateRecord),
        ipAddress,
      });

      return rateRecord;
    });

    revalidateRoomRatePaths(hotel.id, hotel.slug);

    return {
      status: "success",
      message: "Tarifa atualizada com sucesso.",
      rateId: updatedRate.id,
    };
  } catch (error) {
    return {
      status: "error",
      message: getErrorMessage(error, "Não foi possível atualizar a tarifa."),
    };
  }
}

export async function toggleRoomRateActiveAction(
  hotelId: string,
  roomId: string,
  rateId: string,
  isActive: boolean
): Promise<RoomRateActionState> {
  try {
    const parsedParams = parseHotelRoomRateRouteParams({ hotelId, roomId, rateId });

    if (!parsedParams.success) {
      throw new ValidationError(parsedParams.error.issues[0]?.message || "Identificador inválido.");
    }

    if (typeof isActive !== "boolean") {
      throw new ValidationError("Status de ativação inválido.");
    }

    const { user, hotel, rate } = await getAuthorizedRateContext(
      parsedParams.data.hotelId,
      parsedParams.data.roomId,
      parsedParams.data.rateId
    );
    const previousValue = mapRateSnapshot(rate);
    const ipAddress = await getAuditIpAddress();

    const updatedRate = await prisma.$transaction(async (tx) => {
      const rateRecord = await tx.roomRate.update({
        where: {
          id: rate.id,
        },
        data: {
          isActive,
        },
      });

      await createRoomRateAuditLog({
        tx,
        userId: user.id,
        hotelId: hotel.id,
        action: isActive ? "hotel.room_rate.activated" : "hotel.room_rate.deactivated",
        previousValue,
        newValue: mapRateSnapshot(rateRecord),
        ipAddress,
      });

      return rateRecord;
    });

    revalidateRoomRatePaths(hotel.id, hotel.slug);

    return {
      status: "success",
      message: isActive ? "Tarifa ativada com sucesso." : "Tarifa desativada com sucesso.",
      rateId: updatedRate.id,
    };
  } catch (error) {
    return {
      status: "error",
      message: getErrorMessage(error, "Não foi possível alterar o status da tarifa."),
    };
  }
}
