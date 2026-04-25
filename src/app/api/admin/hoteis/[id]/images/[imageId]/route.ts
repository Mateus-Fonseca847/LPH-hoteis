import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";

import { getRequiredSession, requireAuthenticatedRequestUser } from "@/lib/auth";
import { validateAdminTwoFactor } from "@/lib/auth/admin-security";
import { createHotelAuditLog, type HotelAuditSnapshot } from "@/lib/audit/hotel-audit";
import { AuthorizationError, requireHotelEditAccess } from "@/lib/auth/authorization";
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
    policies: hotel.policies.map(({ title, description, position }) => ({ title, description, position })),
  } satisfies HotelAuditSnapshot;
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    await getRequiredSession();

    const { id: hotelId, imageId } = await context.params;
    const user = await requireAuthenticatedRequestUser();
    const twoFactorValidation = await validateAdminTwoFactor(user.id);

    if (!twoFactorValidation.success) {
      return NextResponse.json({ error: twoFactorValidation.message }, { status: 403 });
    }

    await requireHotelEditAccess(user.id, hotelId);

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
      return NextResponse.json({ error: "Hotel não encontrado." }, { status: 404 });
    }

    const imageToRemove = hotel.images.find((image) => image.id === imageId);

    if (!imageToRemove) {
      return NextResponse.json({ error: "Imagem não encontrada." }, { status: 404 });
    }

    const remainingImages = hotel.images.filter((image) => image.id !== imageId);

    if (hotel.coverImageUrl === imageToRemove.url && remainingImages.length === 0) {
      return NextResponse.json(
        { error: "A imagem de capa não pode ser removida sem outra imagem disponível." },
        { status: 400 }
      );
    }

    const nextCoverImageUrl =
      hotel.coverImageUrl === imageToRemove.url ? remainingImages[0]?.url ?? hotel.coverImageUrl : hotel.coverImageUrl;

    const previousValue = buildHotelSnapshot(hotel);
    const nextValue: HotelAuditSnapshot = {
      ...previousValue,
      coverImageUrl: nextCoverImageUrl,
      images: remainingImages.map(({ url, alt, position }) => ({ url, alt, position })),
    };

    const ipAddress =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      null;

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

    await deleteStoredHotelImageFile(imageToRemove.url);

    revalidatePath("/admin/hoteis");
    revalidatePath(`/admin/hoteis/${hotelId}`);
    revalidatePath("/");
    revalidatePath(`/hoteis/${hotel.slug}`);

    return NextResponse.json({
      ok: true,
      removedImageId: imageId,
      nextCoverImageUrl,
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: "Você não tem permissão para remover imagens deste hotel." }, { status: 403 });
    }

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: "Não foi possível remover a imagem." }, { status: 500 });
  }
}
