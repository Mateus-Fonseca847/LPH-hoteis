import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";

import { createHotelAuditLog, type HotelAuditSnapshot } from "@/lib/audit/hotel-audit";
import { NotFoundError, ValidationError, createApiSuccessResponse } from "@/lib/errors/app-error";
import {
  createHotelWriteApiErrorResponse,
  getRequestIpAddress,
  parseHotelImageRouteParams,
  requireAuthorizedHotelWrite,
} from "@/lib/hotel-write";
import { prisma } from "@/lib/prisma";
import { deleteStoredHotelImageFile } from "@/lib/uploads/hotel-images";

type RouteContext = {
  params: Promise<{
    id: string;
    imageId: string;
  }>;
};

type HotelWithRelations = Prisma.HotelGetPayload<{
  include: {
    images: true;
    amenities: true;
    policies: true;
  };
}>;

function buildHotelSnapshot(hotel: HotelWithRelations) {
  return {
    name: hotel.name,
    slug: hotel.slug,
    shortDescription: hotel.shortDescription,
    fullDescription: hotel.fullDescription,
    city: hotel.city,
    state: hotel.state,
    address: hotel.address,
    phone: hotel.phone,
    email: hotel.email,
    whatsapp: hotel.whatsapp,
    coverImageUrl: hotel.coverImageUrl,
    checkInTime: hotel.checkInTime,
    checkOutTime: hotel.checkOutTime,
    isPublished: hotel.isPublished,
    images: hotel.images.map(({ url, alt, position }) => ({ url, alt, position })),
    amenities: hotel.amenities.map(({ label, position }) => ({ label, position })),
    policies: hotel.policies.map(({ title, description, position }) => ({
      title,
      description,
      position,
    })),
  } satisfies HotelAuditSnapshot;
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { id, imageId: rawImageId } = await context.params;
    const parsedParams = parseHotelImageRouteParams({ hotelId: id, imageId: rawImageId });

    if (!parsedParams.success) {
      throw new ValidationError(parsedParams.error.issues[0]?.message || "Identificador inválido.");
    }

    const { hotelId, imageId } = parsedParams.data;
    const user = await requireAuthorizedHotelWrite(hotelId);

    const hotel = await prisma.hotel.findUnique({
      where: {
        id: hotelId,
      },
      include: {
        images: {
          orderBy: {
            position: "asc",
          },
        },
        amenities: {
          orderBy: {
            position: "asc",
          },
        },
        policies: {
          orderBy: {
            position: "asc",
          },
        },
      },
    });

    if (!hotel) {
      throw new NotFoundError("Hotel não encontrado.");
    }

    const imageToRemove = hotel.images.find((image) => image.id === imageId);

    if (!imageToRemove) {
      throw new NotFoundError("Imagem não encontrada.");
    }

    const remainingImages = hotel.images.filter((image) => image.id !== imageId);

    if (hotel.coverImageUrl === imageToRemove.url && remainingImages.length === 0) {
      throw new ValidationError(
        "A imagem de capa não pode ser removida sem outra imagem disponível."
      );
    }

    const nextCoverImageUrl =
      hotel.coverImageUrl === imageToRemove.url
        ? (remainingImages[0]?.url ?? hotel.coverImageUrl)
        : hotel.coverImageUrl;

    const previousValue = buildHotelSnapshot(hotel);
    const nextValue: HotelAuditSnapshot = {
      ...previousValue,
      coverImageUrl: nextCoverImageUrl,
      images: remainingImages.map(({ url, alt, position }) => ({ url, alt, position })),
    };

    const ipAddress = getRequestIpAddress(request.headers);

    await prisma.$transaction(async (tx) => {
      await tx.hotelImage.delete({
        where: {
          id: imageId,
        },
      });

      if (nextCoverImageUrl !== hotel.coverImageUrl) {
        await tx.hotel.update({
          where: {
            id: hotelId,
          },
          data: {
            coverImageUrl: nextCoverImageUrl,
          },
        });
      }

      await createHotelAuditLog({
        tx,
        userId: user.id,
        hotelId,
        action: "hotel.image.removed",
        previousValue,
        newValue: nextValue,
        ipAddress,
      });
    });

    const storageCleanup = await deleteStoredHotelImageFile(imageToRemove.url);

    revalidatePath("/admin/hoteis");
    revalidatePath(`/admin/hoteis/${hotelId}`);
    revalidatePath("/");
    revalidatePath(`/hoteis/${hotel.slug}`);

    return createApiSuccessResponse({
      removedImageId: imageId,
      nextCoverImageUrl,
      storageCleanup: storageCleanup.status,
    });
  } catch (error) {
    return createHotelWriteApiErrorResponse(error, "Não foi possível remover a imagem.");
  }
}
