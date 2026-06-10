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
  NotFoundError,
  ValidationError,
  getErrorMessage,
} from "@/lib/errors/app-error";
import { resolveHotelMapLocation } from "@/lib/hotel-location";
import { getRequestIpAddress } from "@/lib/hotel-write";
import { prisma } from "@/lib/prisma";
import { generateSlugFromName } from "@/lib/slug";
import { storeHotelImageFile } from "@/lib/uploads/hotel-images";
import { hotelContactEmailSchema } from "@/lib/validations/hotel";

export type CreateHotelState = {
  status: "idle" | "success" | "error";
  message: string;
  hotelId?: string;
  errorCode?: CreateHotelErrorCode;
};

export type RemoveHotelState = {
  status: "idle" | "success" | "error";
  message: string;
};

type CreateHotelErrorCode =
  | "CONTACT_EMAIL_REQUIRED"
  | "CONTACT_EMAIL_INVALID"
  | "NAME_REQUIRED"
  | "DUPLICATE_SLUG"
  | "COVER_IMAGE_REQUIRED"
  | "COVER_UPLOAD_FAILED"
  | "IMAGE_STORAGE_NOT_CONFIGURED"
  | "FORBIDDEN"
  | "DATABASE_UNAVAILABLE"
  | "DATABASE_SCHEMA_MISMATCH"
  | "DATABASE_RELATION_FAILED"
  | "VALIDATION_ERROR"
  | "UNEXPECTED_ERROR";

type CreateHotelLogContext = {
  step: string;
  formDiagnostics: ReturnType<typeof getFormDataDiagnostics>;
  userId?: string;
  globalRole?: string;
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

const removeAllowedRoles: HotelRole[] = [HotelRole.owner, HotelRole.admin];

const galleryImageSchema = z.object({
  url: z.string().trim().url("Informe URLs válidas na galeria.").max(500),
  alt: z.string().trim().min(2, "Informe texto alternativo para a galeria.").max(140),
  position: z.number().int().min(0),
});

const galleryImagesSchema = z
  .array(galleryImageSchema)
  .min(1, "Informe pelo menos uma imagem de galeria.")
  .max(20, "Informe no máximo 20 imagens.");

const requiredCreateHotelFields = [
  "name",
  "city",
  "state",
  "shortDescription",
  "fullDescription",
  "address",
  "phone",
  "email",
  "whatsapp",
  "checkInTime",
  "checkOutTime",
] as const;

const localUploadImagePathRegex =
  /^\/uploads\/hotels\/[a-zA-Z0-9_-]{1,191}\/[a-zA-Z0-9][a-zA-Z0-9._-]{0,220}\.(?:jpg|jpeg|png|webp)$/i;

const createHotelSchema = z
  .object({
    name: z.string().trim().min(3, "Informe o nome do hotel.").max(120),
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
      .max(30, "Informe no máximo 30 comodidades."),
    policies: z
      .array(
        z.object({
          title: z.string().trim().min(2, "Informe o título da política.").max(80),
          description: z.string().trim().min(3, "Informe a descrição da política.").max(600),
          position: z.number().int().min(0),
        })
      )
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

async function generateUniqueHotelSlug(name: string) {
  const baseSlug = generateSlugFromName(name).slice(0, 80).replace(/-$/g, "");

  for (let suffix = 1; suffix <= 100; suffix += 1) {
    const suffixText = suffix === 1 ? "" : `-${suffix}`;
    const slug = `${baseSlug.slice(0, 80 - suffixText.length).replace(/-$/g, "")}${suffixText}`;
    const existingHotel = await prisma.hotel.findUnique({
      where: {
        slug,
      },
      select: {
        id: true,
      },
    });

    if (!existingHotel) {
      return slug;
    }
  }

  return `${baseSlug.slice(0, 67).replace(/-$/g, "")}-${randomUUID().slice(0, 12)}`;
}

function getCoverImageFile(formData: FormData) {
  const file = formData.get("coverImage");

  return file instanceof File && file.size > 0 ? file : null;
}

function isAllowedCreateCoverImageUrl(value: string) {
  if (localUploadImagePathRegex.test(value)) {
    return true;
  }

  try {
    const url = new URL(value);

    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function getCreateCoverImageUrl(formData: FormData) {
  const coverImageUrl = String(formData.get("coverImageUrl") ?? "").trim();

  if (!coverImageUrl) {
    return "";
  }

  if (!isAllowedCreateCoverImageUrl(coverImageUrl)) {
    throw new ValidationError("Informe uma URL válida para a imagem de capa.");
  }

  return coverImageUrl;
}

function redactSensitiveText(value: string) {
  return value.replace(
    /(password|secret|token|key|credential)(["'\s:=]+)([^"'\s,}]+)/gi,
    "$1$2[redacted]"
  );
}

function getFormDataDiagnostics(formData: FormData) {
  const keys = Array.from(new Set(Array.from(formData.keys()))).sort();
  const file = formData.get("coverImage");
  const coverImageUrl = String(formData.get("coverImageUrl") ?? "").trim();
  const coverImage =
    file instanceof File
      ? {
          present: file.size > 0,
          name: file.name,
          type: file.type,
          size: file.size,
        }
      : {
          present: false,
        };
  const missingFields = requiredCreateHotelFields.filter(
    (field) => !String(formData.get(field) ?? "").trim()
  );

  return {
    keys,
    missingFields:
      coverImage.present || coverImageUrl ? missingFields : [...missingFields, "coverImage"],
    values: {
      name: String(formData.get("name") ?? "").trim(),
      city: String(formData.get("city") ?? "").trim(),
      state: String(formData.get("state") ?? "").trim(),
      hasShortDescription: Boolean(String(formData.get("shortDescription") ?? "").trim()),
      hasFullDescription: Boolean(String(formData.get("fullDescription") ?? "").trim()),
      hasAddress: Boolean(String(formData.get("address") ?? "").trim()),
      hasPhone: Boolean(String(formData.get("phone") ?? "").trim()),
      hasEmail: Boolean(String(formData.get("email") ?? "").trim()),
      hasWhatsapp: Boolean(String(formData.get("whatsapp") ?? "").trim()),
      amenitiesCount: formData.getAll("amenities").filter((value) => String(value).trim()).length,
      policiesCount: formData.getAll("policies").filter((value) => String(value).trim()).length,
      checkInTime: String(formData.get("checkInTime") ?? "").trim(),
      checkOutTime: String(formData.get("checkOutTime") ?? "").trim(),
      coverImage,
      hasCoverImageUrl: Boolean(coverImageUrl),
    },
  };
}

function getSafeTechnicalError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return {
      name: error.name,
      code: error.code,
      message: redactSensitiveText(error.message),
      meta: error.meta,
      stack: error.stack ? redactSensitiveText(error.stack) : undefined,
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
      stack: error.stack ? redactSensitiveText(error.stack) : undefined,
    };
  }

  if (error instanceof Error) {
    return {
      name: error.name,
      message: redactSensitiveText(error.message),
      stack: error.stack ? redactSensitiveText(error.stack) : undefined,
    };
  }

  return {
    name: "UnknownError",
    message: redactSensitiveText(String(error)),
  };
}

function getCreateHotelErrorStep(error: unknown, fallbackStep: string) {
  if (error instanceof CreateHotelTechnicalError) {
    return error.step;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return "prisma";
  }

  if (
    error instanceof Prisma.PrismaClientInitializationError ||
    error instanceof Prisma.PrismaClientUnknownRequestError ||
    error instanceof Prisma.PrismaClientRustPanicError ||
    error instanceof Prisma.PrismaClientValidationError
  ) {
    return "database";
  }

  return fallbackStep;
}

function logCreateHotelError(error: unknown, context: CreateHotelLogContext) {
  const technicalError =
    error instanceof CreateHotelTechnicalError
      ? getSafeTechnicalError(error.cause)
      : getSafeTechnicalError(error);

  console.error("[admin/hoteis/create] Failed to create hotel.", {
    step: getCreateHotelErrorStep(error, context.step),
    code: technicalError.code,
    message: technicalError.message,
    missingFields: context.formDiagnostics.missingFields,
    userId: context.userId,
    globalRole: context.globalRole,
    error: technicalError,
  });
}

function getCreateHotelErrorCode(error: unknown): CreateHotelErrorCode {
  if (error instanceof AuthorizationError) {
    return "FORBIDDEN";
  }

  if (error instanceof ConflictError) {
    return "DUPLICATE_SLUG";
  }

  if (error instanceof ValidationError) {
    if (error.message === "Informe o e-mail de contato do hotel.") {
      return "CONTACT_EMAIL_REQUIRED";
    }

    if (error.message === "Informe um e-mail de contato válido.") {
      return "CONTACT_EMAIL_INVALID";
    }

    if (error.message === "Informe o nome do hotel.") {
      return "NAME_REQUIRED";
    }

    if (error.message === "Envie uma imagem de capa ou informe a URL da capa.") {
      return "COVER_IMAGE_REQUIRED";
    }

    return "VALIDATION_ERROR";
  }

  if (error instanceof CreateHotelTechnicalError) {
    if (
      error.step === "cover-upload" &&
      error.cause instanceof Error &&
      error.cause.message === "Storage de imagens não configurado."
    ) {
      return "IMAGE_STORAGE_NOT_CONFIGURED";
    }

    return error.step === "cover-upload" ? "COVER_UPLOAD_FAILED" : "DATABASE_RELATION_FAILED";
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return "DUPLICATE_SLUG";
    }

    if (error.code === "P2021" || error.code === "P2022") {
      return "DATABASE_SCHEMA_MISMATCH";
    }

    return "DATABASE_RELATION_FAILED";
  }

  if (
    error instanceof Prisma.PrismaClientInitializationError ||
    error instanceof Prisma.PrismaClientUnknownRequestError ||
    error instanceof Prisma.PrismaClientRustPanicError
  ) {
    return "DATABASE_UNAVAILABLE";
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return "DATABASE_SCHEMA_MISMATCH";
  }

  return "UNEXPECTED_ERROR";
}

function getCreateHotelErrorMessage(error: unknown) {
  switch (getCreateHotelErrorCode(error)) {
    case "CONTACT_EMAIL_REQUIRED":
      return "Informe o e-mail de contato do hotel.";
    case "CONTACT_EMAIL_INVALID":
      return "Informe um e-mail de contato válido.";
    case "NAME_REQUIRED":
      return "Informe o nome do hotel.";
    case "DUPLICATE_SLUG":
      return "Já existe um hotel com este slug.";
    case "COVER_IMAGE_REQUIRED":
      return "Envie uma imagem de capa ou informe a URL da capa.";
    case "COVER_UPLOAD_FAILED":
      return "Falha ao enviar imagem de capa.";
    case "IMAGE_STORAGE_NOT_CONFIGURED":
      return "Storage de imagens não configurado.";
    case "FORBIDDEN":
      return "Você não tem permissão para criar hotéis.";
    case "DATABASE_UNAVAILABLE":
      return "Erro ao salvar hotel. Verifique as configurações do banco.";
    case "DATABASE_SCHEMA_MISMATCH":
      return "Erro ao salvar hotel. Verifique as configurações do banco.";
    case "DATABASE_RELATION_FAILED":
      return "Erro ao salvar hotel. Verifique as configurações do banco.";
    case "VALIDATION_ERROR":
      return getErrorMessage(error, "Dados inválidos.");
    case "UNEXPECTED_ERROR":
      return getErrorMessage(error, "Não foi possível criar o hotel.");
  }
}

function buildCreatedHotelAuditValue(
  payload: z.infer<typeof createHotelSchema>,
  slug: string,
  coverImageUrl: string,
  galleryImages: z.infer<typeof createHotelSchema>["galleryImages"],
  resolvedLocation: ReturnType<typeof resolveHotelMapLocation>
) {
  return {
    name: payload.name,
    slug,
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
  const formDiagnostics = getFormDataDiagnostics(formData);
  const logContext: CreateHotelLogContext = {
    step: "start",
    formDiagnostics,
  };

  try {
    logContext.step = "start";
    console.info("[admin/hoteis/create] Starting hotel creation.", formDiagnostics);

    logContext.step = "auth";
    const user = await requireAuthenticatedRequestUser();
    logContext.userId = user.id;
    logContext.globalRole = user.globalRole;
    console.info("[admin/hoteis/create] Authenticated user.", {
      userId: user.id,
      globalRole: user.globalRole,
      isActive: user.isActive,
    });

    if (user.globalRole !== "super_admin" && user.globalRole !== "hotel_admin") {
      console.warn("[admin/hoteis/create] Permission denied.", {
        userId: user.id,
        globalRole: user.globalRole,
      });
      throw new AuthorizationError("Você não tem permissão para criar hotéis.");
    }

    logContext.step = "validation";
    const parsedPayload = parseCreateHotelFormData(formData);

    if (!parsedPayload.success) {
      console.warn("[admin/hoteis/create] Validation failed.", {
        issues: parsedPayload.error.issues,
        missingFields: formDiagnostics.missingFields,
        received: formDiagnostics.values,
      });
      throw new ValidationError(parsedPayload.error.issues[0]?.message || "Dados inválidos.");
    }

    const payload = parsedPayload.data;
    const coverImageFile = getCoverImageFile(formData);
    const submittedCoverImageUrl = getCreateCoverImageUrl(formData);
    const coverAlt = String(formData.get("coverAlt") ?? "");
    logContext.step = "slug-generation";
    const slug = await generateUniqueHotelSlug(payload.name);

    const hotelId = randomUUID();
    logContext.step = "cover-upload";
    const storedCoverImageUrl = coverImageFile
      ? await storeHotelImageFile(hotelId, coverImageFile)
          .then((storedCoverImage) => {
            console.info("[admin/hoteis/create] Cover image uploaded.", {
              hotelId,
              storageKey: storedCoverImage.storageKey,
              contentType: storedCoverImage.contentType,
              size: storedCoverImage.size,
            });

            return storedCoverImage.url;
          })
          .catch((error) => {
            console.error("[admin/hoteis/create] Cover upload failed.", {
              hotelId,
              error: getSafeTechnicalError(error),
            });

            if (submittedCoverImageUrl) {
              console.warn(
                "[admin/hoteis/create] Using submitted cover URL after upload failure.",
                {
                  hotelId,
                  hasSubmittedCoverImageUrl: true,
                }
              );

              return submittedCoverImageUrl;
            }

            throw new CreateHotelTechnicalError(
              "Falha ao enviar imagem de capa.",
              "cover-upload",
              error
            );
          })
      : submittedCoverImageUrl;

    if (!storedCoverImageUrl) {
      logContext.step = "cover-validation";
      console.warn("[admin/hoteis/create] Missing cover image.", {
        missingFields: formDiagnostics.missingFields,
      });
      throw new ValidationError("Envie uma imagem de capa ou informe a URL da capa.");
    }

    logContext.step = "gallery-validation";
    const parsedGalleryImages = galleryImagesSchema.safeParse(
      parseGalleryImages(formData, payload.name, storedCoverImageUrl, coverAlt)
    );

    if (!parsedGalleryImages.success) {
      console.warn("[admin/hoteis/create] Gallery validation failed.", {
        issues: parsedGalleryImages.error.issues,
      });
      throw new ValidationError(
        parsedGalleryImages.error.issues[0]?.message || "Galeria inválida."
      );
    }

    const galleryImages = parsedGalleryImages.data;
    const resolvedLocation = resolveHotelMapLocation({
      city: payload.city,
      state: payload.state,
    });
    logContext.step = "headers";
    const requestHeaders = await headers();
    const ipAddress = getRequestIpAddress(requestHeaders);
    console.info("[admin/hoteis/create] Persisting hotel draft.", {
      hotelId,
      slug,
      globalRole: user.globalRole,
      galleryImagesCount: galleryImages.length,
      amenitiesCount: payload.amenities.length,
      policiesCount: payload.policies.length,
      hasResolvedLocation: Boolean(resolvedLocation),
    });

    logContext.step = "database-transaction";
    const hotel = await prisma
      .$transaction(async (tx) => {
        const createdHotel = await tx.hotel.create({
          data: {
            id: hotelId,
            name: payload.name,
            slug,
            shortDescription: payload.shortDescription,
            fullDescription: payload.fullDescription,
            city: payload.city,
            state: payload.state,
            address: payload.address,
            phone: payload.phone,
            email: payload.email,
            whatsapp: payload.whatsapp,
            coverImageUrl: storedCoverImageUrl,
            checkInTime: payload.checkInTime,
            checkOutTime: payload.checkOutTime,
            latitude: resolvedLocation ? new Prisma.Decimal(resolvedLocation.latitude) : null,
            longitude: resolvedLocation ? new Prisma.Decimal(resolvedLocation.longitude) : null,
            isPublished: false,
            images: {
              create: galleryImages,
            },
            ...(payload.amenities.length > 0
              ? {
                  amenities: {
                    create: payload.amenities.map((label, position) => ({ label, position })),
                  },
                }
              : {}),
            ...(payload.policies.length > 0
              ? {
                  policies: {
                    create: payload.policies,
                  },
                }
              : {}),
          },
          select: {
            id: true,
          },
        });

        const permission = await tx.hotelPermission.upsert({
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

        console.info("[admin/hoteis/create] HotelPermission ensured for creator.", {
          userId: user.id,
          globalRole: user.globalRole,
          step: "hotel-permission",
          hotelId: createdHotel.id,
          permissionId: permission?.id,
          role: permission?.role ?? HotelRole.owner,
          hotelPermissionEnsured: true,
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
              slug,
              storedCoverImageUrl,
              galleryImages,
              resolvedLocation
            ),
            ipAddress,
          },
        });

        return createdHotel;
      })
      .catch((error) => {
        console.error("[admin/hoteis/create] Prisma transaction failed.", {
          hotelId,
          error: getSafeTechnicalError(error),
        });

        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          throw error;
        }

        throw new CreateHotelTechnicalError(
          "Falha ao salvar hotel, galeria, comodidades ou políticas.",
          "database-transaction",
          error
        );
      });

    console.info("[admin/hoteis/create] Hotel draft created.", {
      userId: user.id,
      globalRole: user.globalRole,
      step: "done",
      hotelId: hotel.id,
      slug,
    });

    revalidatePath("/admin");
    revalidatePath("/admin/hoteis");
    revalidatePath(`/admin/hoteis/${hotel.id}`);
    revalidatePath("/");

    return {
      status: "success",
      message: "Hotel salvo como rascunho.",
      hotelId: hotel.id,
    };
  } catch (error) {
    logCreateHotelError(error, logContext);
    const message = getCreateHotelErrorMessage(error);

    return {
      status: "error",
      message,
      errorCode: getCreateHotelErrorCode(error),
    };
  }
}

export async function removeHotelAction(
  hotelId: string,
  _previousState: RemoveHotelState,
  _formData: FormData
): Promise<RemoveHotelState> {
  void _previousState;
  void _formData;

  try {
    const safeHotelId = z.string().trim().min(1).parse(hotelId);
    const user = await requireAuthenticatedRequestUser();

    if (
      !user.isActive ||
      (user.globalRole !== "super_admin" && user.globalRole !== "hotel_admin")
    ) {
      throw new AuthorizationError("Você não tem permissão para remover este hotel.");
    }

    const hotel = await prisma.hotel.findUnique({
      where: {
        id: safeHotelId,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        isPublished: true,
        isArchived: true,
        reservations: {
          select: {
            id: true,
          },
          take: 1,
        },
        permissions: {
          where: {
            userId: user.id,
            role: {
              in: removeAllowedRoles,
            },
          },
          select: {
            id: true,
            role: true,
          },
          take: 1,
        },
      },
    });

    if (!hotel) {
      throw new NotFoundError("Hotel não encontrado.");
    }

    if (hotel.isArchived) {
      return {
        status: "success",
        message: "Hotel removido com sucesso.",
      };
    }

    if (user.globalRole === "hotel_admin" && hotel.permissions.length === 0) {
      throw new AuthorizationError("Você não tem permissão para remover este hotel.");
    }

    if (hotel.reservations.length > 0) {
      throw new ConflictError("Não é possível remover hotel com reservas vinculadas.");
    }

    const requestHeaders = await headers();
    const ipAddress = getRequestIpAddress(requestHeaders);
    const archivedAt = new Date();

    await prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.findFirst({
        where: {
          hotelId: safeHotelId,
        },
        select: {
          id: true,
        },
      });

      if (reservation) {
        throw new ConflictError("Não é possível remover hotel com reservas vinculadas.");
      }

      await tx.hotel.update({
        where: {
          id: safeHotelId,
        },
        data: {
          isArchived: true,
          isPublished: false,
          archivedAt,
          archivedById: user.id,
        },
      });

      await tx.hotelAuditLog.create({
        data: {
          userId: user.id,
          hotelId: safeHotelId,
          action: "hotel.archived",
          changedFields: ["isArchived", "isPublished", "archivedAt", "archivedById"],
          previousValue: {
            isArchived: false,
            isPublished: hotel.isPublished,
            archivedAt: null,
            archivedById: null,
          },
          newValue: {
            isArchived: true,
            isPublished: false,
            archivedAt: archivedAt.toISOString(),
            archivedById: user.id,
          },
          ipAddress,
        },
      });
    });

    revalidatePath("/");
    revalidatePath("/admin");
    revalidatePath("/admin/hoteis");
    revalidatePath(`/admin/hoteis/${safeHotelId}`);
    revalidatePath(`/hoteis/${hotel.slug}`);
    revalidatePath("/buscar");
    revalidatePath("/mapa");

    return {
      status: "success",
      message: "Hotel removido com sucesso.",
    };
  } catch (error) {
    return {
      status: "error",
      message: getErrorMessage(error, "Não foi possível remover o hotel."),
    };
  }
}
