import { NextResponse } from "next/server";

import { getRequiredSession, requireAuthenticatedRequestUser } from "@/lib/auth";
import { validateAdminTwoFactor } from "@/lib/auth/admin-security";
import { createHotelAuditLog, type HotelAuditSnapshot } from "@/lib/audit/hotel-audit";
import { AuthorizationError, requireHotelEditAccess } from "@/lib/auth/authorization";
import { prisma } from "@/lib/prisma";
import { storeHotelImageFile } from "@/lib/uploads/hotel-images";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    await getRequiredSession();

    const { id: hotelId } = await context.params;
    const user = await requireAuthenticatedRequestUser();
    const twoFactorValidation = await validateAdminTwoFactor(user.id);

    if (!twoFactorValidation.success) {
      return NextResponse.json({ error: twoFactorValidation.message }, { status: 403 });
    }

    await requireHotelEditAccess(user.id, hotelId);

    const contentType = request.headers.get("content-type") || "";

    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json({ error: "Envie a imagem em multipart/form-data." }, { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const alt = String(formData.get("alt") ?? "").trim();
    const setAsCover = String(formData.get("setAsCover") ?? "") === "true";

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Arquivo de imagem não enviado." }, { status: 400 });
    }

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

    const storedImage = await storeHotelImageFile(hotelId, file);
    const nextPosition = hotel.images.length ? Math.max(...hotel.images.map((image) => image.position)) + 1 : 0;
    const finalAlt = alt || `${hotel.name} - imagem ${nextPosition + 1}`;

    const previousValue: HotelAuditSnapshot = {
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
      images: hotel.images.map(({ url, alt: imageAlt, position }) => ({ url, alt: imageAlt, position })),
      amenities: hotel.amenities.map(({ label, position }) => ({ label, position })),
      policies: hotel.policies.map(({ title, description, position }) => ({ title, description, position })),
    };

    const nextValue: HotelAuditSnapshot = {
      ...previousValue,
      coverImageUrl: setAsCover ? storedImage.url : previousValue.coverImageUrl,
      images: [
        ...previousValue.images,
        {
          url: storedImage.url,
          alt: finalAlt,
          position: nextPosition,
        },
      ],
    };

    const ipAddress =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      null;

    const createdImage = await prisma.$transaction(async (tx) => {
      const image = await tx.hotelImage.create({
        data: {
          hotelId,
          url: storedImage.url,
          alt: finalAlt,
          position: nextPosition,
        },
      });

      if (setAsCover) {
        await tx.hotel.update({
          where: {
            id: hotelId,
          },
          data: {
            coverImageUrl: storedImage.url,
          },
        });
      }

      await createHotelAuditLog({
        tx,
        userId: user.id,
        hotelId,
        action: "hotel.image.uploaded",
        previousValue,
        newValue: nextValue,
        ipAddress,
      });

      return image;
    });

    return NextResponse.json({
      ok: true,
      image: {
        id: createdImage.id,
        url: storedImage.url,
        alt: finalAlt,
        position: nextPosition,
        setAsCover,
      },
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: "Você não tem permissão para enviar imagens para este hotel." }, { status: 403 });
    }

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: "Não foi possível concluir o upload." }, { status: 500 });
  }
}
