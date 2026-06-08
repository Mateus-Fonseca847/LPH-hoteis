import { z } from "zod";

const BRAZILIAN_STATES = new Set([
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
]);

function sanitizeText(value: string) {
  return value
    .replace(/[\u0000-\u001F\u007F]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function sanitizeOptionalText(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const sanitized = sanitizeText(value);
  return sanitized.length > 0 ? sanitized : undefined;
}

const requiredTextSchema = (field: string, min = 1, max = 160) =>
  z
    .string()
    .transform(sanitizeText)
    .pipe(
      z
        .string()
        .min(min, `${field} obrigatório.`)
        .max(max, `${field} deve ter no máximo ${max} caracteres.`)
    );

export const hotelOwnerSignupPayloadSchema = z
  .object({
    responsibleName: requiredTextSchema("Nome do responsável", 3, 120),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("E-mail inválido.")
      .max(160, "E-mail deve ter no máximo 160 caracteres."),
    phone: requiredTextSchema("Telefone", 1, 40),
    hotelName: requiredTextSchema("Nome do hotel", 1, 160),
    hotelCity: requiredTextSchema("Cidade do hotel", 1, 120),
    hotelState: z
      .string()
      .trim()
      .toUpperCase()
      .refine((value) => BRAZILIAN_STATES.has(value), "UF inválida."),
    hotelDocument: z.preprocess(sanitizeOptionalText, z.string().max(40).optional()),
    message: z.preprocess(sanitizeOptionalText, z.string().max(1000).optional()),
  })
  .strict();

export type HotelOwnerSignupPayload = z.infer<typeof hotelOwnerSignupPayloadSchema>;

export function parseHotelOwnerSignupPayload(payload: unknown) {
  const result = hotelOwnerSignupPayloadSchema.safeParse(payload);

  if (!result.success) {
    return {
      success: false as const,
      error: result.error.issues[0]?.message || "Dados de solicitação inválidos.",
      issues: result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    };
  }

  return {
    success: true as const,
    data: result.data,
  };
}
