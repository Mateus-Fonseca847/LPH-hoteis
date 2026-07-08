import { z } from "zod";

import {
  HOTEL_EXPERIENCE_CATEGORIES,
  HOTEL_EXPERIENCE_PREFERENCES,
} from "@/lib/hotel-experience-options";
import { getZodErrorMessage } from "@/lib/errorMessages";
import { getCanonicalAmenityLabel } from "@/lib/hotel-amenities";

const allowedHotelFormKeys = new Set([
  "name",
  "slug",
  "shortDescription",
  "fullDescription",
  "city",
  "state",
  "address",
  "phone",
  "email",
  "whatsapp",
  "coverImageUrl",
  "gallery",
  "amenities",
  "policies",
  "experiences",
  "checkInTime",
  "checkOutTime",
  "isPublished",
  "latitude",
  "longitude",
]);

const allowedHotelUploadFormKeys = new Set(["file", "files", "alt", "setAsCover"]);

function sanitizeText(value: string) {
  return value
    .replace(/[\u0000-\u001F\u007F]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function sanitizeMultilineText(value: string) {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]+/g, " ")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

function parseDelimitedEntries(entries: FormDataEntryValue[]) {
  return entries
    .map((entry) => String(entry ?? ""))
    .flatMap((value) => value.split(/\r?\n/))
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseExperienceEntries(entry: FormDataEntryValue | null) {
  const rawValue = String(entry ?? "").trim();

  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue);

    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

const textField = (label: string, min: number, max: number) =>
  z
    .string()
    .transform(sanitizeText)
    .pipe(
      z
        .string()
        .min(min, `${label} deve ter pelo menos ${min} caracteres.`)
        .max(max, `${label} deve ter no máximo ${max} caracteres.`)
    );

const multilineField = (label: string, min: number, max: number) =>
  z
    .string()
    .transform(sanitizeMultilineText)
    .pipe(
      z
        .string()
        .min(min, `${label} deve ter pelo menos ${min} caracteres.`)
        .max(max, `${label} deve ter no máximo ${max} caracteres.`)
    );

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug inválido.")
  .min(3, "Slug deve ter pelo menos 3 caracteres.")
  .max(80, "Slug deve ter no máximo 80 caracteres.");

const stateSchema = z
  .string()
  .transform((value) => value.trim().toUpperCase())
  .pipe(z.string().regex(/^[A-Z]{2}$/, "Estado deve ter 2 letras."));

const phoneSchema = z
  .string()
  .transform(sanitizeText)
  .pipe(z.string().regex(/^\+?[0-9()\-.\s]{8,24}$/, "Telefone inválido."));

export const hotelContactEmailSchema = z
  .string()
  .transform((value) => value.trim().toLowerCase())
  .pipe(
    z
      .string()
      .min(1, "Informe o e-mail de contato do hotel.")
      .max(160, "E-mail muito longo.")
      .email("Informe um e-mail de contato válido.")
  );

const timeSchema = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Horário inválido. Use HH:MM.");

const optionalCoordinateSchema = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((value) => {
    if (value === null || value === undefined) {
      return null;
    }

    const text = String(value).trim();

    if (!text) {
      return null;
    }

    const numericValue = Number(text.replace(",", "."));

    return Number.isFinite(numericValue) ? numericValue : Number.NaN;
  })
  .pipe(z.number().min(-180, "Coordenada inválida.").max(180, "Coordenada inválida.").nullable());

const localUploadImagePathRegex =
  /^\/uploads\/hotels\/[a-zA-Z0-9_-]{1,191}\/[a-zA-Z0-9][a-zA-Z0-9._-]{0,220}\.(?:jpg|jpeg|png|webp)$/i;

function isAllowedImageUrl(value: string) {
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

const imageUrlSchema = z
  .string()
  .trim()
  .max(500, "URL muito longa.")
  .refine(
    isAllowedImageUrl,
    "URL de imagem inválida. Use uma URL HTTP/HTTPS ou um caminho local de upload."
  );

const hotelAmenitySchema = z
  .object({
    label: textField("Comodidade", 2, 80),
    position: z.number().int().min(0).max(200),
  })
  .strict();

const hotelPolicySchema = z
  .object({
    title: textField("Título da política", 2, 80),
    description: multilineField("Descrição da política", 3, 600),
    position: z.number().int().min(0).max(200),
  })
  .strict();

const hotelImageSchema = z
  .object({
    url: imageUrlSchema,
    alt: textField("Texto alternativo da imagem", 2, 140),
    position: z.number().int().min(0).max(200),
  })
  .strict();

const hotelExperienceCategorySchema = z.enum(HOTEL_EXPERIENCE_CATEGORIES);
const hotelExperiencePreferenceSchema = z.enum(HOTEL_EXPERIENCE_PREFERENCES);

const hotelExperienceSchema = z
  .object({
    title: textField("Título da experiência", 2, 120),
    city: textField("Cidade da experiência", 2, 80),
    state: stateSchema,
    shortDescription: multilineField("Descrição curta da experiência", 10, 320),
    imageUrl: imageUrlSchema,
    imageAlt: textField("Texto alternativo da imagem da experiência", 2, 140),
    categories: z
      .array(hotelExperienceCategorySchema)
      .min(1, "Selecione pelo menos uma categoria para a experiência.")
      .max(HOTEL_EXPERIENCE_CATEGORIES.length, "Categorias inválidas."),
    preferences: z
      .array(hotelExperiencePreferenceSchema)
      .max(HOTEL_EXPERIENCE_PREFERENCES.length, "Preferências inválidas."),
    distanceText: z
      .string()
      .transform(sanitizeText)
      .pipe(z.string().max(80, "Distância/proximidade deve ter no máximo 80 caracteres."))
      .nullable(),
    isActive: z.boolean(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (new Set(value.categories).size !== value.categories.length) {
      ctx.addIssue({
        code: "custom",
        path: ["categories"],
        message: "Não repita a mesma categoria na experiência.",
      });
    }

    if (new Set(value.preferences).size !== value.preferences.length) {
      ctx.addIssue({
        code: "custom",
        path: ["preferences"],
        message: "Não repita a mesma preferência na experiência.",
      });
    }
  });

export const hotelPayloadSchema = z
  .object({
    name: textField("Nome", 3, 120),
    slug: slugSchema,
    shortDescription: multilineField("Descrição curta", 10, 220),
    fullDescription: multilineField("Descrição completa", 30, 4000),
    city: textField("Cidade", 2, 80),
    state: stateSchema,
    address: multilineField("Endereço", 8, 180),
    phone: phoneSchema,
    email: hotelContactEmailSchema,
    whatsapp: phoneSchema,
    coverImageUrl: imageUrlSchema,
    images: z
      .array(hotelImageSchema)
      .min(1, "Adicione pelo menos uma imagem.")
      .max(20, "Máximo de 20 imagens."),
    amenities: z
      .array(hotelAmenitySchema)
      .min(1, "Adicione pelo menos uma comodidade.")
      .max(30, "Máximo de 30 comodidades."),
    policies: z
      .array(hotelPolicySchema)
      .min(1, "Adicione pelo menos uma política.")
      .max(20, "Máximo de 20 políticas."),
    experiences: z.array(hotelExperienceSchema).max(30, "Máximo de 30 experiências."),
    latitude: optionalCoordinateSchema,
    longitude: optionalCoordinateSchema,
    checkInTime: timeSchema,
    checkOutTime: timeSchema,
    isPublished: z.boolean(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const imageUrls = new Set<string>();
    const imagePositions = new Set<number>();
    const amenityLabels = new Set<string>();

    value.images.forEach((image, index) => {
      if (imageUrls.has(image.url)) {
        ctx.addIssue({
          code: "custom",
          path: ["images", index, "url"],
          message: "Não repita a mesma URL de imagem.",
        });
      }

      if (imagePositions.has(image.position)) {
        ctx.addIssue({
          code: "custom",
          path: ["images", index, "position"],
          message: "As imagens precisam ter posições únicas.",
        });
      }

      imageUrls.add(image.url);
      imagePositions.add(image.position);
    });

    value.amenities.forEach((amenity, index) => {
      const normalizedLabel = amenity.label
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();

      if (amenityLabels.has(normalizedLabel)) {
        ctx.addIssue({
          code: "custom",
          path: ["amenities", index, "label"],
          message: "Não repita a mesma comodidade.",
        });
      }

      amenityLabels.add(normalizedLabel);
    });

    if ((value.latitude === null) !== (value.longitude === null)) {
      ctx.addIssue({
        code: "custom",
        path: value.latitude === null ? ["latitude"] : ["longitude"],
        message: "Informe latitude e longitude juntas ou deixe ambas vazias.",
      });
    }
  });

export type HotelPayload = z.infer<typeof hotelPayloadSchema>;
export type HotelExperiencePayload = z.infer<typeof hotelExperienceSchema>;

const uploadAltSchema = z
  .string()
  .transform(sanitizeText)
  .pipe(z.string().max(140, "Texto alternativo muito longo."));

const uploadFlagsSchema = z
  .object({
    alt: uploadAltSchema,
    setAsCover: z.boolean(),
  })
  .strict();

export function parseHotelFormData(formData: FormData) {
  const receivedKeys = new Set<string>();

  for (const key of formData.keys()) {
    receivedKeys.add(key);
  }

  const unexpectedKeys = [...receivedKeys].filter((key) => !allowedHotelFormKeys.has(key));

  if (unexpectedKeys.length > 0) {
    return {
      success: false as const,
      error: `Campos inesperados: ${unexpectedKeys.join(", ")}.`,
    };
  }

  const parseLines = (key: string) => parseDelimitedEntries(formData.getAll(key));

  const name = String(formData.get("name") ?? "");
  const gallery = parseLines("gallery").map((line, index) => {
    const [url, alt] = line.split("|").map((item) => item.trim());

    return {
      url,
      alt: alt || `${sanitizeText(name || "Hotel")} - imagem ${index + 1}`,
      position: index,
    };
  });

  const amenities = parseLines("amenities").map((label, index) => ({
    label: getCanonicalAmenityLabel(label),
    position: index,
  }));

  const policies = parseLines("policies").map((line, index) => {
    const [title, ...descriptionParts] = line.split("|");

    return {
      title: title?.trim() ?? "",
      description: descriptionParts.join("|").trim(),
      position: index,
    };
  });
  const parsedExperiences = parseExperienceEntries(formData.get("experiences"));

  if (parsedExperiences === null) {
    return {
      success: false as const,
      error: "Experiências próximas inválidas.",
    };
  }

  const result = hotelPayloadSchema.safeParse({
    name,
    slug: String(formData.get("slug") ?? ""),
    shortDescription: String(formData.get("shortDescription") ?? ""),
    fullDescription: String(formData.get("fullDescription") ?? ""),
    city: String(formData.get("city") ?? ""),
    state: String(formData.get("state") ?? ""),
    address: String(formData.get("address") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    email: String(formData.get("email") ?? ""),
    whatsapp: String(formData.get("whatsapp") ?? ""),
    coverImageUrl: String(formData.get("coverImageUrl") ?? ""),
    images: gallery.length
      ? gallery
      : [
          {
            url: String(formData.get("coverImageUrl") ?? ""),
            alt: `${sanitizeText(name || "Hotel")} - capa`,
            position: 0,
          },
        ],
    amenities,
    policies,
    experiences: parsedExperiences.map((experience) => ({
      title: String(experience?.title ?? ""),
      city: String(experience?.city ?? ""),
      state: String(experience?.state ?? ""),
      shortDescription: String(experience?.shortDescription ?? ""),
      imageUrl: String(experience?.imageUrl ?? ""),
      imageAlt: String(experience?.imageAlt ?? ""),
      categories: Array.isArray(experience?.categories)
        ? experience.categories.map((value: unknown) => String(value ?? ""))
        : [],
      preferences: Array.isArray(experience?.preferences)
        ? experience.preferences.map((value: unknown) => String(value ?? ""))
        : [],
      distanceText:
        experience?.distanceText === null || experience?.distanceText === undefined
          ? null
          : String(experience.distanceText),
      isActive: Boolean(experience?.isActive),
    })),
    latitude: formData.get("latitude"),
    longitude: formData.get("longitude"),
    checkInTime: String(formData.get("checkInTime") ?? ""),
    checkOutTime: String(formData.get("checkOutTime") ?? ""),
    isPublished: formData.get("isPublished") === "on",
  });

  if (!result.success) {
    return {
      success: false as const,
      error: getZodErrorMessage(result.error, "Verifique os dados do hotel."),
    };
  }

  return {
    success: true as const,
    data: result.data,
  };
}

export function parseHotelUploadFormData(formData: FormData) {
  const receivedKeys = new Set<string>();

  for (const key of formData.keys()) {
    receivedKeys.add(key);
  }

  const unexpectedKeys = [...receivedKeys].filter((key) => !allowedHotelUploadFormKeys.has(key));

  if (unexpectedKeys.length > 0) {
    return {
      success: false as const,
      error: `Campos inesperados: ${unexpectedKeys.join(", ")}.`,
    };
  }

  const files = formData
    .getAll("files")
    .filter((item): item is File => item instanceof File && item.size > 0);
  const singleFile = formData.get("file");
  const normalizedFiles =
    files.length > 0
      ? files
      : singleFile instanceof File && singleFile.size > 0
        ? [singleFile]
        : [];

  if (normalizedFiles.length === 0) {
    return {
      success: false as const,
      error: "Nenhuma imagem válida foi enviada.",
    };
  }

  if (normalizedFiles.length > 10) {
    return {
      success: false as const,
      error: "Envie no máximo 10 imagens por vez.",
    };
  }

  const parsedFlags = uploadFlagsSchema.safeParse({
    alt: String(formData.get("alt") ?? ""),
    setAsCover: String(formData.get("setAsCover") ?? "") === "true",
  });

  if (!parsedFlags.success) {
    return {
      success: false as const,
      error: getZodErrorMessage(parsedFlags.error, "Verifique os dados do upload."),
    };
  }

  if (parsedFlags.data.setAsCover && normalizedFiles.length > 1) {
    return {
      success: false as const,
      error: "Defina apenas uma imagem para a capa por vez.",
    };
  }

  return {
    success: true as const,
    data: {
      files: normalizedFiles,
      alt: parsedFlags.data.alt,
      setAsCover: parsedFlags.data.setAsCover,
    },
  };
}

export function isValidHotelContactEmail(value: string | null | undefined) {
  return hotelContactEmailSchema.safeParse(value ?? "").success;
}
