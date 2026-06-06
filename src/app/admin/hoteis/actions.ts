"use server";

import { randomUUID } from "node:crypto";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { HotelRole, Prisma } from "@prisma/client";

import { requireAuthenticatedRequestUser } from "@/lib/auth";
import {
  ConflictError,
  AuthorizationError,
  ValidationError,
  getErrorMessage,
} from "@/lib/errors/app-error";
import { resolveHotelMapLocation } from "@/lib/hotel-location";
import { getRequestIpAddress } from "@/lib/hotel-write";
import { prisma } from "@/lib/prisma";
import { storeHotelImageFile } from "@/lib/uploads/hotel-images";
import { hotelContactEmailSchema } from "@/lib/validations/hotel";

export type CreateHotelState = {
  status: "idle" | "success" | "error";
  message: string;
  hotelId?: string;
};

class CreateHotelTechnicalError extends Error {
  readonly userMessage: string;
  readonly step: string;
  readonly cause: unknown;

  constructor(userMessage: string, step: string, cause: unknown) {
    super(userMessage);
    this.name = "CreateHotelTechnicalError";
    this.userMessage = userMessage;
    this.step = step;
    this.cause = cause;
  }
}

const galleryImageSchema = z.object({
  url: z.string().trim().url("Informe URLs válidas na galeria.").max(500),
  alt: z.string().trim().min(2, "Informe texto alternativo para a galeria.").max(140),
  position: z.number().int().min(0),
});

const galleryImagesSchema = z
  .array(galleryImageSchema)
  .min(1, "Informe pelo menos uma imagem de galeria.")
  .max(20, "Informe no máximo 20 imagens.");

const createHotelSchema = z
  .object({
    name: z.string().trim().min(3, "Informe o nome do hotel.").max(120),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use um slug com letras, números e hífens.")
      .min(3, "Slug deve ter pelo menos 3 caracteres.")
      .max(80),
    city: z.string().trim().min(2, "Informe a cidade.").max(80),
    state: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{2}$/, "Estado deve ter 2 letras."),
    shortDescription: z
      .string()
      .trim()
      .min(10, "Informe uma descrição curta com pelo menos 10 caracteres.")
      .max(220),
    fullDescription: z
      .string()
      .trim()
      .min(30, "Informe uma descrição completa com pelo menos 30 caracteres.")
      .max(4000),
    address: z.string().trim().min(8, "Informe o endereço.").max(180),
    phone: z
      .string()
      .trim()
      .regex(/^\+?[0-9()\-.\s]{8,24}$/, "Telefone inválido."),
    email: hotelContactEmailSchema,
    whatsapp: z
      .string()
      .trim()
      .regex(/^\+?[0-9()\-.\s]{8,24}$/, "WhatsApp inválido."),
    galleryImages: z.array(galleryImageSchema).max(20, "Informe no máximo 20 imagens."),
    amenities: z
      .array(z.string().trim().min(2, "Informe comodidades válidas.").max(80))
      .min(1, "Informe pelo menos uma comodidade.")
      .max(30, "Informe no máximo 30 comodidades."),
    policies: z
      .array(
        z.object({
          title: z.string().trim().min(2, "Informe o título da política.").max(80),
          description: z.string().trim().min(3, "Informe a descrição da política.").max(600),
          position: z.number().int().min(0),
        })
      )
      .min(1, "Informe pelo menos uma política.")
      .max(20, "Informe no máximo 20 políticas."),
    checkInTime: z
      .string()
      .trim()
      .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Check-in inválido."),
    checkOutTime: z
      .string()
      .trim()
      .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Check-out inválido."),
  })
  .strict();

function parseLines(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseStringEntries(formData: FormData, name: string) {
  return formData
    .getAll(name)
    .map((value) => String(value).trim())
    .filter(Boolean);
}

function parseGalleryImages(
  formData: FormData,
  hotelName: string,
  coverImageUrl: string,
  coverAlt: string
) {
  const entries = parseLines(formData.get("galleryImages"));
  const fallbackAlt = coverAlt.trim() || `${hotelName} - capa`;
  const lines = entries.length ? entries : [`${coverImageUrl}|${fallbackAlt}`];

  return lines.map((line, index) => {
    const [url, ...altParts] = line.split("|");
    const alt = altParts.join("|").trim() || `${hotelName} - imagem ${index + 1}`;

    return {
      url: url?.trim() ?? "",
      alt,
      position: index,
    };
  });
}

function parseAmenityValues(formData: FormData) {
  const repeatedEntries = parseStringEntries(formData, "amenities");

  if (repeatedEntries.length > 0) {
    return repeatedEntries;
  }

  return parseLines(formData.get("amenities"));
}

function parsePolicies(formData: FormData) {
  const repeatedEntries = parseStringEntries(formData, "policies");
  const entries =
    repeatedEntries.length > 0 ? repeatedEntries : parseLines(formData.get("policies"));

  return entries.map((line, index) => {
    if (line.startsWith("{")) {
      try {
        const parsed = z
          .object({
            title: z.string().trim(),
            description: z.string().trim(),
          })
          .safeParse(JSON.parse(line));

        if (parsed.success) {
          return {
            title: parsed.data.title,
            description: parsed.data.description,
            position: index,
          };
        }
      } catch {
        // Fallback para o formato legado título|descrição.
      }
    }

    const [title, ...descriptionParts] = line.split("|");

    return {
      title: title?.trim() ?? "",
      description: descriptionParts.join("|").trim(),
      position: index,
    };
  });
}

function parseCreateHotelFormData(formData: FormData) {
  const name = String(formData.get("name") ?? "");

  return createHotelSchema.safeParse({
    name,
    slug: String(formData.get("slug") ?? ""),
    city: String(formData.get("city") ?? ""),
    state: String(formData.get("state") ?? ""),
    shortDescription: String(formData.get("shortDescription") ?? ""),
    fullDescription: String(formData.get("fullDescription") ?? ""),
    address: String(formData.get("address") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    email: String(formData.get("email") ?? ""),
    whatsapp: String(formData.get("whatsapp") ?? ""),
    galleryImages: [],
    amenities: parseAmenityValues(formData),
    policies: parsePolicies(formData),
    checkInTime: String(formData.get("checkInTime") ?? ""),
    checkOutTime: String(formData.get("checkOutTime") ?? ""),
  });
}

function getRequiredCoverImageFile(formData: FormData) {
  const file = formData.get("coverImage");

  if (!(file instanceof File) || file.size <= 0) {
    throw new ValidationError("Envie uma imagem de capa.");
  }

  return file;
}

function redactSensitiveText(value: string) {
  return value.replace(
    /(password|secret|token|key|credential)(["'\s:=]+)([^"'\s,}]+)/gi,
    "$1$2[redacted]"
  );
}

function getSafeTechnicalError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return {
      name: error.name,
      code: error.code,
      message: redactSensitiveText(error.message),
      meta: error.meta,
    };
  }

  if (
    error instanceof Prisma.PrismaClientInitializationError ||
    error instanceof Prisma.PrismaClientUnknownRequestError ||
    error instanceof Prisma.PrismaClientRustPanicError ||
    error instanceof Prisma.PrismaClientValidationError
  ) {
    return {
      name: error.name,
      message: redactSensitiveText(error.message),
    };
  }

  if (error instanceof Error) {
    return {
      name: error.name,
      message: redactSensitiveText(error.message),
    };
  }

  return {
    name: "UnknownError",
    message: redactSensitiveText(String(error)),
  };
}

function logCreateHotelError(error: unknown) {
  if (
    error instanceof ValidationError ||
    error instanceof AuthorizationError ||
    error instanceof ConflictError
  ) {
    return;
  }

  if (error instanceof CreateHotelTechnicalError) {
    console.error("[admin/hoteis/create] Failed to create hotel.", {
      step: error.step,
      cause: getSafeTechnicalError(error.cause),
    });
    return;
  }

  console.error("[admin/hoteis/create] Failed to create hotel.", getSafeTechnicalError(error));
}

function getCreateHotelPrismaErrorMessage(error: Prisma.PrismaClientKnownRequestError) {
  if (error.code === "P2002") {
    const target = Array.isArray(error.meta?.target) ? error.meta.target.join(",") : "";

    return target.includes("slug")
      ? "Já existe um hotel com este slug."
      : "Já existe um cadastro com dados únicos repetidos.";
  }

  if (error.code === "P2021" || error.code === "P2022") {
    return "Falha de schema do banco. Verifique se as migrations foram aplicadas.";
  }

  if (error.code === "P2003") {
    return "Falha ao vincular dados relacionados do hotel.";
  }

  return "Falha ao salvar hotel, galeria, comodidades ou políticas.";
}

function getCreateHotelErrorMessage(error: unknown) {
  if (error instanceof CreateHotelTechnicalError) {
    return error.userMessage;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return getCreateHotelPrismaErrorMessage(error);
  }

  if (
    error instanceof Prisma.PrismaClientInitializationError ||
    error instanceof Prisma.PrismaClientUnknownRequestError ||
    error instanceof Prisma.PrismaClientRustPanicError ||
    error instanceof Prisma.PrismaClientValidationError
  ) {
    return "Falha de banco de dados ao criar hotel. Verifique schema e migrations.";
  }

  return getErrorMessage(error, "Não foi possível criar o hotel.");
}

function buildCreatedHotelAuditValue(
  payload: z.infer<typeof createHotelSchema>,
  coverImageUrl: string,
  galleryImages: z.infer<typeof createHotelSchema>["galleryImages"],
  resolvedLocation: ReturnType<typeof resolveHotelMapLocation>
) {
  return {
    name: payload.name,
    slug: payload.slug,
    shortDescription: payload.shortDescription,
    fullDescription: payload.fullDescription,
    city: payload.city,
    state: payload.state,
    address: payload.address,
    latitude: resolvedLocation?.latitude ?? null,
    longitude: resolvedLocation?.longitude ?? null,
    phone: payload.phone,
    email: payload.email,
    whatsapp: payload.whatsapp,
    coverImageUrl,
    checkInTime: payload.checkInTime,
    checkOutTime: payload.checkOutTime,
    isPublished: false,
    images: galleryImages,
    amenities: payload.amenities,
    policies: payload.policies,
    experiences: [],
  };
}

export async function createHotelAction(
  _previousState: CreateHotelState,
  formData: FormData
): Promise<CreateHotelState> {
  try {
    const user = await requireAuthenticatedRequestUser();

    if (user.globalRole !== "super_admin" && user.globalRole !== "hotel_admin") {
      throw new AuthorizationError("Você não tem permissão para criar hotéis.");
    }

    const parsedPayload = parseCreateHotelFormData(formData);

    if (!parsedPayload.success) {
      throw new ValidationError(parsedPayload.error.issues[0]?.message || "Dados inválidos.");
    }

    const payload = parsedPayload.data;
    const coverImageFile = getRequiredCoverImageFile(formData);
    const coverAlt = String(formData.get("coverAlt") ?? "");
    const existingSlug = await prisma.hotel.findUnique({
      where: {
        slug: payload.slug,
      },
      select: {
        id: true,
      },
    });

    if (existingSlug) {
      throw new ConflictError("Já existe um hotel com este slug.");
    }

    const hotelId = randomUUID();
    const storedCoverImage = await storeHotelImageFile(hotelId, coverImageFile).catch((error) => {
      throw new CreateHotelTechnicalError(
        "Falha ao enviar imagem. Verifique o storage.",
        "cover-upload",
        error
      );
    });
    const parsedGalleryImages = galleryImagesSchema.safeParse(
      parseGalleryImages(formData, payload.name, storedCoverImage.url, coverAlt)
    );

    if (!parsedGalleryImages.success) {
      throw new ValidationError(
        parsedGalleryImages.error.issues[0]?.message || "Galeria inválida."
      );
    }

    const galleryImages = parsedGalleryImages.data;
    const resolvedLocation = resolveHotelMapLocation({
      city: payload.city,
      state: payload.state,
    });
    const requestHeaders = await headers();
    const ipAddress = getRequestIpAddress(requestHeaders);

    const hotel = await prisma
      .$transaction(async (tx) => {
        const createdHotel = await tx.hotel.create({
          data: {
            id: hotelId,
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
            coverImageUrl: storedCoverImage.url,
            checkInTime: payload.checkInTime,
            checkOutTime: payload.checkOutTime,
            latitude: resolvedLocation ? new Prisma.Decimal(resolvedLocation.latitude) : null,
            longitude: resolvedLocation ? new Prisma.Decimal(resolvedLocation.longitude) : null,
            isPublished: false,
            images: {
              create: galleryImages,
            },
            amenities: {
              create: payload.amenities.map((label, position) => ({ label, position })),
            },
            policies: {
              create: payload.policies,
            },
          },
          select: {
            id: true,
          },
        });

        await tx.hotelPermission.upsert({
          where: {
            userId_hotelId: {
              userId: user.id,
              hotelId: createdHotel.id,
            },
          },
          update: {
            role: HotelRole.owner,
          },
          create: {
            userId: user.id,
            hotelId: createdHotel.id,
            role: HotelRole.owner,
          },
        });

        await tx.hotelAuditLog.create({
          data: {
            userId: user.id,
            hotelId: createdHotel.id,
            action: "hotel.profile.created",
            changedFields: [
              "name",
              "slug",
              "shortDescription",
              "fullDescription",
              "city",
              "state",
              "address",
              "latitude",
              "longitude",
              "phone",
              "email",
              "whatsapp",
              "coverImageUrl",
              "checkInTime",
              "checkOutTime",
              "isPublished",
              "images",
              "amenities",
              "policies",
              "experiences",
            ],
            previousValue: Prisma.JsonNull,
            newValue: buildCreatedHotelAuditValue(
              payload,
              storedCoverImage.url,
              galleryImages,
              resolvedLocation
            ),
            ipAddress,
          },
        });

        return createdHotel;
      })
      .catch((error) => {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          throw error;
        }

        throw new CreateHotelTechnicalError(
          "Falha ao salvar hotel, galeria, comodidades ou políticas.",
          "database-transaction",
          error
        );
      });

    revalidatePath("/admin");
    revalidatePath("/admin/hoteis");
    revalidatePath(`/admin/hoteis/${hotel.id}`);
    revalidatePath("/");

    return {
      status: "success",
      message: "Hotel criado com sucesso. Abrindo a gestão da unidade.",
      hotelId: hotel.id,
    };
  } catch (error) {
    logCreateHotelError(error);

    return {
      status: "error",
      message: getCreateHotelErrorMessage(error),
    };
  }
}
