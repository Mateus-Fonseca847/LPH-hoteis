import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";

import { createHotelAuditLog, type HotelAuditSnapshot } from "@/lib/audit/hotel-audit";
import { NotFoundError, ValidationError, createApiSuccessResponse } from "@/lib/errors/app-error";
import {
  createHotelWriteApiErrorResponse,
  getRequestIpAddress,
  parseHotelRouteParams,
  requireAuthorizedHotelWrite,
} from "@/lib/hotel-write";
import { prisma } from "@/lib/prisma";
import { storeHotelImageFile } from "@/lib/uploads/hotel-images";
import { parseHotelUploadFormData } from "@/lib/validations/hotel";

type RouteContext = {
  params: Promise<{
    id: string;
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

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const parsedParams = parseHotelRouteParams({ hotelId: id });

    if (!parsedParams.success) {
      throw new ValidationError(parsedParams.error.issues[0]?.message || "Identificador inválido.");
    }

    const hotelId = parsedParams.data.hotelId;
    const user = await requireAuthorizedHotelWrite(hotelId);
    const contentType = request.headers.get("content-type") || "";

    if (!contentType.includes("multipart/form-data")) {
      throw new ValidationError("Envie a imagem em multipart/form-data.");
    }

    const formData = await request.formData();
    const parsedUpload = parseHotelUploadFormData(formData);

    if (!parsedUpload.success) {
      throw new ValidationError(parsedUpload.error);
    }

    const { files: normalizedFiles, alt: altBase, setAsCover } = parsedUpload.data;

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

    const previousValue = buildHotelSnapshot(hotel);
    const nextPositionStart = hotel.images.length
      ? Math.max(...hotel.images.map((image) => image.position)) + 1
      : 0;
    const storedImages = await Promise.all(
      normalizedFiles.map((file) => storeHotelImageFile(hotelId, file))
    );

    const createdImagesPayload = storedImages.map((storedImage, index) => ({
      url: storedImage.url,
      alt: altBase || `${hotel.name} - imagem ${nextPositionStart + index + 1}`,
      position: nextPositionStart + index,
    }));

    const nextValue: HotelAuditSnapshot = {
      ...previousValue,
      coverImageUrl: setAsCover ? createdImagesPayload[0].url : previousValue.coverImageUrl,
      images: [...previousValue.images, ...createdImagesPayload],
    };

    const ipAddress = getRequestIpAddress(request.headers);

    const createdImages = await prisma.$transaction(async (tx) => {
      const images = await Promise.all(
        createdImagesPayload.map((image) =>
          tx.hotelImage.create({
            data: {
              hotelId,
              url: image.url,
              alt: image.alt,
              position: image.position,
            },
          })
        )
      );

      if (setAsCover) {
        await tx.hotel.update({
          where: {
            id: hotelId,
          },
          data: {
            coverImageUrl: createdImagesPayload[0].url,
          },
        });
      }

      await createHotelAuditLog({
        tx,
        userId: user.id,
        hotelId,
        action: setAsCover ? "hotel.cover.uploaded" : "hotel.gallery.uploaded",
        previousValue,
        newValue: nextValue,
        ipAddress,
      });

      return images;
    });

    revalidatePath("/admin/hoteis");
    revalidatePath(`/admin/hoteis/${hotelId}`);
    revalidatePath("/");
    revalidatePath(`/hoteis/${hotel.slug}`);

    return createApiSuccessResponse({
      images: createdImages.map((image, index) => ({
        id: image.id,
        url: image.url,
        alt: image.alt,
        position: image.position,
        setAsCover: setAsCover && index === 0,
      })),
    });
  } catch (error) {
    return createHotelWriteApiErrorResponse(error, "Não foi possível concluir o upload.");
  }
}
