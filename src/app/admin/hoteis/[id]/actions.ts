"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { createHotelAuditLog, type HotelAuditSnapshot } from "@/lib/audit/hotel-audit";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
  getErrorMessage,
} from "@/lib/errors/app-error";
import {
  getRequestIpAddress,
  parseHotelRouteParams,
  requireAuthorizedHotelWrite,
} from "@/lib/hotel-write";
import { prisma } from "@/lib/prisma";
import { parseHotelFormData } from "@/lib/validations/hotel";

export type HotelEditorState = {
  status: "idle" | "success" | "error";
  message: string;
};

export async function updateHotelProfileAction(
  hotelId: string,
  _previousState: HotelEditorState,
  formData: FormData
): Promise<HotelEditorState> {
  try {
    const parsedParams = parseHotelRouteParams({ hotelId });

    if (!parsedParams.success) {
      throw new ValidationError(parsedParams.error.issues[0]?.message || "Identificador inválido.");
    }

    const safeHotelId = parsedParams.data.hotelId;
    const user = await requireAuthorizedHotelWrite(safeHotelId);

    const parsedPayload = parseHotelFormData(formData);

    if (!parsedPayload.success) {
      throw new ValidationError(parsedPayload.error);
    }

    const payload = parsedPayload.data;

    const currentHotel = await prisma.hotel.findUnique({
      where: {
        id: safeHotelId,
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

    if (!currentHotel) {
      throw new NotFoundError("Hotel não encontrado.");
    }

    const existingSlug = await prisma.hotel.findFirst({
      where: {
        slug: payload.slug,
        NOT: {
          id: safeHotelId,
        },
      },
      select: {
        id: true,
      },
    });

    if (existingSlug) {
      throw new ConflictError("Este slug já está em uso por outro hotel.");
    }

    const previousValue: HotelAuditSnapshot = {
      name: currentHotel.name,
      slug: currentHotel.slug,
      shortDescription: currentHotel.shortDescription,
      fullDescription: currentHotel.fullDescription,
      city: currentHotel.city,
      state: currentHotel.state,
      address: currentHotel.address,
      phone: currentHotel.phone,
      email: currentHotel.email,
      whatsapp: currentHotel.whatsapp,
      coverImageUrl: currentHotel.coverImageUrl,
      checkInTime: currentHotel.checkInTime,
      checkOutTime: currentHotel.checkOutTime,
      isPublished: currentHotel.isPublished,
      images: currentHotel.images.map(({ url, alt, position }) => ({ url, alt, position })),
      amenities: currentHotel.amenities.map(({ label, position }) => ({ label, position })),
      policies: currentHotel.policies.map(({ title, description, position }) => ({
        title,
        description,
        position,
      })),
    };

    const nextValue: HotelAuditSnapshot = {
      name: payload.name,
      slug: payload.slug,
      shortDescription: payload.shortDescription,
      fullDescription: payload.fullDescription,
      city: payload.city,
      state: payload.state,
      address: payload.address,
      phone: payload.phone,
      email: payload.email,
      whatsapp: payload.whatsapp,
      coverImageUrl: payload.coverImageUrl,
      checkInTime: payload.checkInTime,
      checkOutTime: payload.checkOutTime,
      isPublished: payload.isPublished,
      images: payload.images,
      amenities: payload.amenities,
      policies: payload.policies,
    };

    const requestHeaders = await headers();
    const ipAddress = getRequestIpAddress(requestHeaders);

    const updatedHotel = await prisma.$transaction(async (tx) => {
      const hotel = await tx.hotel.update({
        where: {
          id: safeHotelId,
        },
        data: {
          name: payload.name,
          slug: payload.slug,
          shortDescription: payload.shortDescription,
          fullDescription: payload.fullDescription,
          city: payload.city,
          state: payload.state,
          address: payload.address,
          phone: payload.phone,
          email: payload.email,
          whatsapp: payload.whatsapp,
          coverImageUrl: payload.coverImageUrl,
          checkInTime: payload.checkInTime,
          checkOutTime: payload.checkOutTime,
          isPublished: payload.isPublished,
          images: {
            deleteMany: {},
            create: payload.images,
          },
          amenities: {
            deleteMany: {},
            create: payload.amenities,
          },
          policies: {
            deleteMany: {},
            create: payload.policies,
          },
        },
        select: {
          slug: true,
        },
      });

      await createHotelAuditLog({
        tx,
        userId: user.id,
        hotelId: safeHotelId,
        action: "hotel.profile.updated",
        previousValue,
        newValue: nextValue,
        ipAddress,
      });

      return hotel;
    });

    revalidatePath("/admin/hoteis");
    revalidatePath(`/admin/hoteis/${safeHotelId}`);
    revalidatePath("/");
    revalidatePath(`/hoteis/${currentHotel.slug}`);

    if (updatedHotel.slug !== currentHotel.slug) {
      revalidatePath(`/hoteis/${updatedHotel.slug}`);
    }

    return {
      status: "success",
      message: "Hotel salvo com sucesso e publicado imediatamente.",
    };
  } catch (error) {
    return {
      status: "error",
      message: getErrorMessage(error, "Não foi possível salvar as alterações."),
    };
  }
}
