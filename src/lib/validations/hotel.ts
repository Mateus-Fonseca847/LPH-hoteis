import { z } from "zod";

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

function sanitizeText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function sanitizeMultilineText(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
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

const urlSchema = z.url("URL inválida.").max(500, "URL muito longa.");

const hotelAmenitySchema = z.object({
  label: textField("Comodidade", 2, 80),
  position: z.number().int().min(0).max(200),
});

const hotelPolicySchema = z.object({
  title: textField("Título da política", 2, 80),
  description: multilineField("Descrição da política", 3, 600),
  position: z.number().int().min(0).max(200),
});

const hotelImageSchema = z.object({
  url: urlSchema,
  alt: textField("Texto alternativo da imagem", 2, 140),
  position: z.number().int().min(0).max(200),
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
    email: z.email("E-mail inválido.").max(160, "E-mail muito longo.").transform((value) => value.trim().toLowerCase()),
    whatsapp: phoneSchema,
    coverImageUrl: urlSchema,
    images: z.array(hotelImageSchema).min(1, "Adicione pelo menos uma imagem.").max(20, "Máximo de 20 imagens."),
    amenities: z.array(hotelAmenitySchema).min(1, "Adicione pelo menos uma comodidade.").max(30, "Máximo de 30 comodidades."),
    policies: z.array(hotelPolicySchema).min(1, "Adicione pelo menos uma política.").max(20, "Máximo de 20 políticas."),
    checkInTime: timeSchema,
    checkOutTime: timeSchema,
    isPublished: z.boolean(),
  })
  .strict();

export type HotelPayload = z.infer<typeof hotelPayloadSchema>;

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

  const parseLines = (value: FormDataEntryValue | null) =>
    String(value ?? "")
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean);

  const name = String(formData.get("name") ?? "");
  const gallery = parseLines(formData.get("gallery")).map((line, index) => {
    const [url, alt] = line.split("|").map((item) => item.trim());

    return {
      url,
      alt: alt || `${sanitizeText(name || "Hotel")} - imagem ${index + 1}`,
      position: index,
    };
  });

  const amenities = parseLines(formData.get("amenities")).map((label, index) => ({
    label,
    position: index,
  }));

  const policies = parseLines(formData.get("policies")).map((line, index) => {
    const [title, ...descriptionParts] = line.split("|");

    return {
      title: title?.trim() || `Política ${index + 1}`,
      description: descriptionParts.join("|").trim() || "Descrição não informada.",
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
