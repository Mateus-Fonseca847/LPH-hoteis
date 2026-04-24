"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { getRequiredSession, requireAuthenticatedRequestUser } from "@/lib/auth";
import { validateAdminTwoFactor } from "@/lib/auth/admin-security";
import { createHotelAuditLog, type HotelAuditSnapshot } from "@/lib/audit/hotel-audit";
import { AuthorizationError, requireHotelEditAccess } from "@/lib/auth/authorization";
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
    await getRequiredSession();

    const user = await requireAuthenticatedRequestUser();
    const twoFactorValidation = await validateAdminTwoFactor(user.id);

    if (!twoFactorValidation.success) {
      return {
        status: "error",
        message: twoFactorValidation.message,
      };
    }

    await requireHotelEditAccess(user.id, hotelId);

    const parsedPayload = parseHotelFormData(formData);

    if (!parsedPayload.success) {
      return {
        status: "error",
        message: parsedPayload.error,
      };
    }

    const payload = parsedPayload.data;

    const currentHotel = await prisma.hotel.findUnique({
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

    if (!currentHotel) {
      return {
        status: "error",
        message: "Hotel não encontrado.",
      };
    }

    const existingSlug = await prisma.hotel.findFirst({
      where: {
        slug: payload.slug,
        NOT: {
          id: hotelId,
        },
      },
      select: {
        id: true,
      },
    });

    if (existingSlug) {
      return {
        status: "error",
        message: "Este slug já está em uso por outro hotel.",
      };
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
    const forwardedFor = requestHeaders.get("x-forwarded-for");
    const ipAddress = forwardedFor?.split(",")[0]?.trim() || requestHeaders.get("x-real-ip") || null;

    const updatedHotel = await prisma.$transaction(async (tx) => {
      const hotel = await tx.hotel.update({
        where: {
          id: hotelId,
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
        hotelId,
        action: "hotel.profile.updated",
        previousValue,
        newValue: nextValue,
        ipAddress,
      });

      return hotel;
    });

    revalidatePath("/admin/hoteis");
    revalidatePath(`/admin/hoteis/${hotelId}`);
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
    if (error instanceof AuthorizationError) {
      return {
        status: "error",
        message: "Você não tem permissão para editar este hotel.",
      };
    }

    return {
      status: "error",
      message: "Não foi possível salvar as alterações.",
    };
  }
}
