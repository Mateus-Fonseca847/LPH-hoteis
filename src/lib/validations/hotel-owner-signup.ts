import { z } from "zod";

import { isValidCnpj, normalizeCnpj } from "@/lib/cnpj";

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

function normalizeRequiredCnpj(value: unknown) {
  return typeof value === "string" ? normalizeCnpj(value) : "";
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

const passwordSchema = z
  .string()
  .min(1, "Informe a senha.")
  .min(8, "A senha deve ter pelo menos 8 caracteres.")
  .max(200, "Senha muito longa.")
  .regex(/[A-Za-z]/, "A senha deve conter pelo menos uma letra.")
  .regex(/\d/, "A senha deve conter pelo menos um número.");

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
    hotelDocument: z.preprocess(
      normalizeRequiredCnpj,
      z
        .string()
        .length(14, "Informe um CNPJ válido no formato 00.000.000/0000-00.")
        .refine(isValidCnpj, "Informe um CNPJ válido no formato 00.000.000/0000-00.")
    ),
    message: z.preprocess(sanitizeOptionalText, z.string().max(1000).optional()),
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Confirme a senha.").max(200, "Senha muito longa."),
  })
  .strict()
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "A confirmação de senha não confere.",
  });

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
