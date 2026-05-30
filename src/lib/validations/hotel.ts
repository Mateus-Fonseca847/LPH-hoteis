import { z } from "zod";

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
  "checkInTime",
  "checkOutTime",
  "isPublished",
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

const timeSchema = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Horário inválido. Use HH:MM.");

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
    email: z
      .email("E-mail inválido.")
      .max(160, "E-mail muito longo.")
      .transform((value) => value.trim().toLowerCase()),
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
  });

export type HotelPayload = z.infer<typeof hotelPayloadSchema>;

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
    checkInTime: String(formData.get("checkInTime") ?? ""),
    checkOutTime: String(formData.get("checkOutTime") ?? ""),
    isPublished: formData.get("isPublished") === "on",
  });

  if (!result.success) {
    return {
      success: false as const,
      error: result.error.issues[0]?.message || "Payload inválido.",
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
      error: parsedFlags.error.issues[0]?.message || "Payload inválido.",
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
