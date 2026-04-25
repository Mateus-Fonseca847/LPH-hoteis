import { z } from "zod";

import { ValidationError, createApiErrorResponse } from "@/lib/errors/app-error";

const loginPayloadSchema = z
  .object({
    email: z.email("Informe um e-mail válido.").max(160, "E-mail muito longo."),
    password: z.string().min(1, "Informe a senha.").max(200, "Senha muito longa."),
  })
  .strict();

const twoFactorPayloadSchema = z
  .object({
    token: z.string().trim().min(1, "Informe o código.").max(32, "Código inválido."),
  })
  .strict();

export function parseLoginRequestBody(body: unknown) {
  return loginPayloadSchema.safeParse(body);
}

export function parseTwoFactorRequestBody(body: unknown) {
  return twoFactorPayloadSchema.safeParse(body);
}

export function createAuthApiErrorResponse(error: unknown, fallbackMessage: string) {
  return createApiErrorResponse(error, fallbackMessage);
}

export function getFirstValidationErrorMessage(result: {
  error?: { issues?: Array<{ message?: string }> };
}) {
  return result.error?.issues?.[0]?.message || "Payload inválido.";
}

export function createValidationErrorFromResult(result: {
  error?: { issues?: Array<{ message?: string }> };
}) {
  return new ValidationError(getFirstValidationErrorMessage(result));
}
