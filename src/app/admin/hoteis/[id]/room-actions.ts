"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { createHotelRoomAuditLog, type HotelRoomAuditSnapshot } from "@/lib/audit/hotel-room-audit";
import {
  AuthorizationError,
  getErrorMessage,
  NotFoundError,
  ValidationError,
} from "@/lib/errors/app-error";
import {
  getRequestIpAddress,
  parseHotelRouteParams,
  parseHotelRoomRouteParams,
  requireAuthorizedHotelWrite,
} from "@/lib/hotel-write";
import { prisma } from "@/lib/prisma";
import { canonicalizeBedsValue, canonicalizeRoomAmenityLabels } from "@/lib/room-options";
import { deleteStoredHotelImageFile } from "@/lib/uploads/hotel-images";
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
  images: Array<{
    id?: string;
    url: string;
    alt: string;
    position: number;
  }>;
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
  images?: Array<{
    id?: string;
    url: string;
    alt: string;
    position: number;
  }>;
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
  const normalizedBeds = canonicalizeBedsValue(room.beds);
  const normalizedAmenities = canonicalizeRoomAmenityLabels(room.amenities);

  return {
    id: room.id,
    name: room.name,
    description: room.description,
    imageUrl: room.imageUrl,
    images:
      room.images && room.images.length > 0
        ? room.images
        : room.imageUrl.trim()
          ? [
              {
                url: room.imageUrl,
                alt: `Imagem do quarto ${room.name}`,
                position: 0,
              },
            ]
          : [],
    capacityAdults: room.capacityAdults,
    capacityChildren: room.capacityChildren,
    beds: normalizedBeds.success ? normalizedBeds.value : room.beds,
    sizeM2: room.sizeM2,
    amenities: normalizedAmenities.success ? normalizedAmenities.value : room.amenities,
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

function buildRoomImagesPayload(
  roomName: string,
  imageUrl: string,
  images:
    | Array<{
        url: string;
        alt: string;
        position: number;
      }>
    | undefined
) {
  const sourceImages =
    images ??
    (imageUrl.trim()
      ? [
          {
            url: imageUrl,
            alt: `Imagem do quarto ${roomName}`,
            position: 0,
          },
        ]
      : []);

  return sourceImages
    .filter((image) => image.url.trim())
    .map((image, index) => ({
      url: image.url,
      alt: image.alt || `Imagem do quarto ${roomName}`,
      position: index,
    }));
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
      include: {
        images: {
          orderBy: {
            position: "asc",
          },
          select: {
            id: true,
            url: true,
            alt: true,
            position: true,
          },
        },
      },
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
    const roomImages = buildRoomImagesPayload(
      roomPayload.name,
      roomPayload.imageUrl,
      roomPayload.images
    );
    const primaryImageUrl = roomImages[0]?.url ?? roomPayload.imageUrl;
    const derived = buildRoomDerivedData(roomPayload);
    const ipAddress = await getAuditIpAddress();

    const createdRoom = await prisma.$transaction(async (tx) => {
      const room = await tx.hotelRoom.create({
        data: {
          hotelId: hotel.id,
          name: roomPayload.name,
          description: roomPayload.description,
          imageUrl: primaryImageUrl,
          images: {
            create: roomImages,
          },
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
    const nextImages = roomPayload.images
      ? buildRoomImagesPayload(
          roomPayload.name ?? room.name,
          roomPayload.imageUrl ?? room.imageUrl,
          roomPayload.images
        )
      : null;
    const nextImageUrl = nextImages?.[0]?.url ?? roomPayload.imageUrl ?? room.imageUrl;
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
          imageUrl: nextImageUrl,
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

      if (nextImages) {
        await tx.hotelRoomImage.deleteMany({
          where: {
            roomId: room.id,
          },
        });

        await tx.hotelRoomImage.createMany({
          data: nextImages.map((image) => ({
            roomId: room.id,
            ...image,
          })),
        });
      }

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

export async function removeHotelRoomImageAction(
  hotelId: string,
  roomId: string,
  imageId: string
): Promise<HotelRoomActionState> {
  let removedImageUrl = "";

  try {
    const parsedParams = parseHotelRoomRouteParams({ hotelId, roomId });

    if (!parsedParams.success) {
      throw new ValidationError(parsedParams.error.issues[0]?.message || "Identificador inválido.");
    }

    if (!imageId.trim()) {
      throw new ValidationError("Identificador da imagem inválido.");
    }

    const { user, hotel, room } = await getAuthorizedRoomContext(
      parsedParams.data.hotelId,
      parsedParams.data.roomId
    );
    const previousValue = mapRoomSnapshot(room);
    const ipAddress = await getAuditIpAddress();

    await prisma.$transaction(async (tx) => {
      const images = await tx.hotelRoomImage.findMany({
        where: {
          roomId: room.id,
        },
        orderBy: {
          position: "asc",
        },
      });
      const imageToRemove = images.find((image) => image.id === imageId);

      if (!imageToRemove) {
        throw new NotFoundError("Imagem não encontrada.");
      }

      removedImageUrl = imageToRemove.url;

      await tx.hotelRoomImage.delete({
        where: {
          id: imageToRemove.id,
        },
      });

      const remainingImages = images
        .filter((image) => image.id !== imageToRemove.id)
        .map((image, index) => ({
          ...image,
          position: index,
        }));
      const nextPrimaryImage = remainingImages[0];

      for (const image of remainingImages) {
        await tx.hotelRoomImage.update({
          where: {
            id: image.id,
          },
          data: {
            position: image.position,
          },
        });
      }

      const roomRecord = await tx.hotelRoom.update({
        where: {
          id: room.id,
        },
        data: {
          imageUrl: nextPrimaryImage?.url ?? "",
        },
      });

      await createHotelRoomAuditLog({
        tx,
        userId: user.id,
        hotelId: hotel.id,
        action: "hotel.room_image.removed",
        previousValue,
        newValue: mapRoomSnapshot(roomRecord),
        ipAddress,
      });
    });

    if (removedImageUrl) {
      await deleteStoredHotelImageFile(removedImageUrl).catch((error) => {
        console.warn("[admin/hoteis/rooms/images/remove] Storage cleanup failed.", {
          hotelId: hotel.id,
          roomId: room.id,
          imageId,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }

    revalidateHotelRoomPaths(hotel.id, hotel.slug);

    return {
      status: "success",
      message: "Imagem removida com sucesso.",
      roomId: room.id,
    };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return {
        status: "error",
        message: "Você não tem permissão para remover esta imagem.",
      };
    }

    return {
      status: "error",
      message: getErrorMessage(error, "Não foi possível remover a imagem."),
    };
  }
}
