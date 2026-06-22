"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { createHotelAuditLog, type HotelAuditSnapshot } from "@/lib/audit/hotel-audit";
import { requireAuthenticatedRequestUser } from "@/lib/auth";
import {
  AuthorizationError,
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
import { normalizeCoordinateValue, resolveHotelMapLocation } from "@/lib/hotel-location";
import { prisma } from "@/lib/prisma";
import { isValidHotelContactEmail, parseHotelFormData } from "@/lib/validations/hotel";

export type HotelEditorState = {
  status: "idle" | "success" | "error";
  message: string;
};

export type HotelPublishState = {
  status: "idle" | "success" | "error";
  message: string;
};

export type HotelApprovalState = {
  status: "idle" | "success" | "error";
  message: string;
};

const requiredApprovalFields = [
  "name",
  "shortDescription",
  "fullDescription",
  "address",
  "phone",
  "whatsapp",
  "coverImageUrl",
  "checkInTime",
  "checkOutTime",
] as const;

function resolveHotelCoordinatesForPersistence(input: {
  city: string;
  state: string;
  currentLatitude: unknown;
  currentLongitude: unknown;
  nextLatitude: number | null;
  nextLongitude: number | null;
  cityOrStateChanged: boolean;
  allowManualOverride: boolean;
}) {
  if (input.allowManualOverride && input.nextLatitude !== null && input.nextLongitude !== null) {
    const manualLocation = resolveHotelMapLocation({
      city: input.city,
      state: input.state,
      latitude: input.nextLatitude,
      longitude: input.nextLongitude,
    });

    return manualLocation
      ? {
          latitude: manualLocation.latitude,
          longitude: manualLocation.longitude,
        }
      : null;
  }

  if (!input.cityOrStateChanged) {
    const currentLatitude = normalizeCoordinateValue(input.currentLatitude);
    const currentLongitude = normalizeCoordinateValue(input.currentLongitude);

    if (currentLatitude !== null && currentLongitude !== null) {
      return {
        latitude: currentLatitude,
        longitude: currentLongitude,
      };
    }
  }

  const resolvedLocation = resolveHotelMapLocation({
    city: input.city,
    state: input.state,
  });

  return resolvedLocation
    ? {
        latitude: resolvedLocation.latitude,
        longitude: resolvedLocation.longitude,
      }
    : null;
}

function hasText(value: string | null | undefined) {
  return Boolean(value?.trim());
}

async function getHotelApprovalReadiness(hotelId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const hotel = await prisma.hotel.findUnique({
    where: {
      id: hotelId,
    },
    select: {
      id: true,
      slug: true,
      isPublished: true,
      isArchived: true,
      name: true,
      shortDescription: true,
      fullDescription: true,
      address: true,
      phone: true,
      email: true,
      whatsapp: true,
      coverImageUrl: true,
      checkInTime: true,
      checkOutTime: true,
      city: true,
      state: true,
      latitude: true,
      longitude: true,
      images: {
        select: {
          id: true,
        },
        take: 1,
      },
      amenities: {
        select: {
          id: true,
        },
        take: 1,
      },
      policies: {
        select: {
          id: true,
        },
        take: 1,
      },
      rooms: {
        where: {
          isActive: true,
        },
        select: {
          id: true,
          rates: {
            where: {
              isActive: true,
            },
            select: {
              id: true,
            },
            take: 1,
          },
          availability: {
            where: {
              date: {
                gte: today,
              },
              closed: false,
              availableUnits: {
                gt: 0,
              },
            },
            select: {
              id: true,
            },
            take: 1,
          },
        },
      },
    },
  });

  if (!hotel || hotel.isArchived) {
    throw new NotFoundError("Hotel não encontrado.");
  }

  const missing: string[] = requiredApprovalFields
    .filter((field) => !hasText(hotel[field]))
    .map((field) => field);

  if (!isValidHotelContactEmail(hotel.email)) {
    missing.push("contactEmail");
  }

  if (hotel.images.length === 0) {
    missing.push("images");
  }

  if (hotel.amenities.length === 0) {
    missing.push("amenities");
  }

  if (hotel.policies.length === 0) {
    missing.push("policies");
  }

  if (hotel.rooms.length === 0) {
    missing.push("rooms");
  }

  if (!hotel.rooms.some((room) => room.rates.length > 0)) {
    missing.push("rates");
  }

  if (!hotel.rooms.some((room) => room.availability.length > 0)) {
    missing.push("availability");
  }

  if (
    !resolveHotelMapLocation({
      city: hotel.city,
      state: hotel.state,
      latitude: hotel.latitude,
      longitude: hotel.longitude,
    })
  ) {
    missing.push("mapLocation");
  }

  return {
    hotel,
    missing,
    isReady: missing.length === 0,
  };
}

function getApprovalErrorMessage(missing: string[]) {
  const labels: Record<string, string> = {
    name: "nome",
    shortDescription: "descrição curta",
    fullDescription: "descrição completa",
    address: "endereço",
    phone: "telefone",
    contactEmail: "e-mail de contato valido",
    whatsapp: "WhatsApp",
    coverImageUrl: "imagem de capa",
    checkInTime: "check-in",
    checkOutTime: "check-out",
    images: "galeria",
    amenities: "comodidades",
    policies: "politicas",
    rooms: "quarto",
    rates: "tarifa",
    availability: "disponibilidade futura",
    mapLocation: "localização no mapa",
  };

  if (missing.includes("contactEmail")) {
    return "Este hotel precisa de um e-mail de contato valido antes de ser aprovado.";
  }

  if (missing.some((item) => ["rooms", "rates", "availability"].includes(item))) {
    return "Complete quartos, tarifas e disponibilidade antes de enviar para aprovação.";
  }

  return `Complete antes de enviar para aprovação: ${missing.map((item) => labels[item] ?? item).join(", ")}.`;
}

function getPublishErrorMessage(missing: string[]) {
  if (missing.includes("rooms")) {
    return "Cadastre pelo menos um quarto ativo antes de publicar.";
  }

  if (missing.includes("rates")) {
    return "Cadastre pelo menos uma tarifa ativa antes de publicar.";
  }

  if (missing.includes("availability")) {
    return "Defina disponibilidade antes de publicar.";
  }

  return getApprovalErrorMessage(missing);
}

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
    const hasManualCoordinates = payload.latitude !== null || payload.longitude !== null;

    if (payload.isPublished && user.globalRole !== "super_admin") {
      throw new AuthorizationError("Apenas o super administrador pode aprovar ou publicar hotéis.");
    }

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
        experiences: {
          orderBy: [{ createdAt: "asc" }, { title: "asc" }],
        },
      },
    });

    if (!currentHotel || currentHotel.isArchived) {
      throw new NotFoundError("Hotel não encontrado.");
    }

    if (user.globalRole === "super_admin" && hasManualCoordinates) {
      const manualLocation = resolveHotelMapLocation({
        city: payload.city,
        state: payload.state,
        latitude: payload.latitude,
        longitude: payload.longitude,
      });

      if (!manualLocation || manualLocation.source !== "coordinates") {
        throw new ValidationError("Informe coordenadas válidas para um ponto no Brasil.");
      }
    }

    if (payload.isPublished && !currentHotel.isPublished) {
      const readiness = await getHotelApprovalReadiness(safeHotelId);

      if (!readiness.isReady) {
        throw new ValidationError(getApprovalErrorMessage(readiness.missing));
      }
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
      latitude: normalizeCoordinateValue(currentHotel.latitude),
      longitude: normalizeCoordinateValue(currentHotel.longitude),
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
      experiences: currentHotel.experiences.map(
        ({
          title,
          city,
          state,
          shortDescription,
          imageUrl,
          imageAlt,
          categories,
          preferences,
          distanceText,
          isActive,
        }) => ({
          title,
          city,
          state,
          shortDescription,
          imageUrl,
          imageAlt,
          categories,
          preferences,
          distanceText,
          isActive,
        })
      ),
    };

    const nextCoordinates = resolveHotelCoordinatesForPersistence({
      city: payload.city,
      state: payload.state,
      currentLatitude: currentHotel.latitude,
      currentLongitude: currentHotel.longitude,
      nextLatitude: payload.latitude,
      nextLongitude: payload.longitude,
      cityOrStateChanged:
        payload.city !== currentHotel.city || payload.state !== currentHotel.state,
      allowManualOverride: user.globalRole === "super_admin",
    });

    const nextValue: HotelAuditSnapshot = {
      name: payload.name,
      slug: payload.slug,
      shortDescription: payload.shortDescription,
      fullDescription: payload.fullDescription,
      city: payload.city,
      state: payload.state,
      address: payload.address,
      latitude: nextCoordinates?.latitude ?? null,
      longitude: nextCoordinates?.longitude ?? null,
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
      experiences: payload.experiences,
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
          latitude: nextCoordinates ? new Prisma.Decimal(nextCoordinates.latitude) : null,
          longitude: nextCoordinates ? new Prisma.Decimal(nextCoordinates.longitude) : null,
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
          experiences: {
            deleteMany: {},
            create: payload.experiences.map((experience) => ({
              ...experience,
              distanceText: experience.distanceText?.trim() ? experience.distanceText : null,
            })),
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
      message: "Hotel salvo com sucesso.",
    };
  } catch (error) {
    return {
      status: "error",
      message: getErrorMessage(error, "Não foi possível salvar as alterações."),
    };
  }
}

export async function submitHotelForApprovalAction(
  hotelId: string,
  _previousState: HotelApprovalState,
  _formData: FormData
): Promise<HotelApprovalState> {
  void _previousState;
  void _formData;

  try {
    const parsedParams = parseHotelRouteParams({ hotelId });

    if (!parsedParams.success) {
      throw new ValidationError(parsedParams.error.issues[0]?.message || "Identificador inválido.");
    }

    const safeHotelId = parsedParams.data.hotelId;
    const user = await requireAuthorizedHotelWrite(safeHotelId);
    const readiness = await getHotelApprovalReadiness(safeHotelId);

    if (!readiness.isReady) {
      throw new ValidationError(getApprovalErrorMessage(readiness.missing));
    }

    const requestHeaders = await headers();
    const ipAddress = getRequestIpAddress(requestHeaders);

    await prisma.hotelAuditLog.create({
      data: {
        userId: user.id,
        hotelId: safeHotelId,
        action: "hotel.approval.submitted",
        changedFields: ["approval"],
        previousValue: Prisma.JsonNull,
        newValue: {
          status: "submitted_for_approval",
          submittedAt: new Date().toISOString(),
        },
        ipAddress,
      },
    });

    revalidatePath("/admin/hoteis");
    revalidatePath(`/admin/hoteis/${safeHotelId}`);

    return {
      status: "success",
      message: "Hotel enviado para aprovação.",
    };
  } catch (error) {
    return {
      status: "error",
      message: getErrorMessage(error, "Não foi possível enviar o hotel para aprovação."),
    };
  }
}

export async function approveHotelAction(
  hotelId: string,
  _previousState: HotelPublishState,
  _formData: FormData
): Promise<HotelPublishState> {
  void _previousState;
  void _formData;

  try {
    const parsedParams = parseHotelRouteParams({ hotelId });

    if (!parsedParams.success) {
      throw new ValidationError(parsedParams.error.issues[0]?.message || "Identificador inválido.");
    }

    const user = await requireAuthenticatedRequestUser();

    if (user.globalRole !== "super_admin") {
      throw new AuthorizationError("Apenas o super administrador pode aprovar e publicar hotéis.");
    }

    const safeHotelId = parsedParams.data.hotelId;
    const readiness = await getHotelApprovalReadiness(safeHotelId);

    if (readiness.hotel.isPublished) {
      throw new ValidationError("Hotel já está publicado.");
    }

    const submission = await prisma.hotelAuditLog.findFirst({
      where: {
        hotelId: safeHotelId,
        action: "hotel.approval.submitted",
      },
      select: {
        id: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!submission) {
      throw new ValidationError("Hotel ainda não foi enviado para aprovação.");
    }

    if (!readiness.isReady) {
      throw new ValidationError(getPublishErrorMessage(readiness.missing));
    }

    const requestHeaders = await headers();
    const ipAddress = getRequestIpAddress(requestHeaders);

    await prisma.$transaction(async (tx) => {
      await tx.hotel.update({
        where: {
          id: safeHotelId,
        },
        data: {
          isPublished: true,
        },
      });

      await tx.hotelAuditLog.create({
        data: {
          userId: user.id,
          hotelId: safeHotelId,
          action: "hotel.approval.published",
          changedFields: ["isPublished", "approval"],
          previousValue: {
            isPublished: false,
            status: "submitted_for_approval",
          },
          newValue: {
            isPublished: true,
            status: "published",
            approvedAt: new Date().toISOString(),
            approvedById: user.id,
          },
          ipAddress,
        },
      });
    });

    revalidatePath("/admin");
    revalidatePath("/admin/hoteis");
    revalidatePath(`/admin/hoteis/${safeHotelId}`);
    revalidatePath("/");
    revalidatePath("/mapa");
    revalidatePath("/buscar");
    revalidatePath(`/hoteis/${readiness.hotel.slug}`);

    return {
      status: "success",
      message: "Hotel aprovado e publicado.",
    };
  } catch (error) {
    return {
      status: "error",
      message: getErrorMessage(error, "Não foi possível aprovar e publicar o hotel."),
    };
  }
}
