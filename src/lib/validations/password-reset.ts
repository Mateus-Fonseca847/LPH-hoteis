import { z } from "zod";

const passwordSchema = z
  .string()
  .min(1, "Informe a nova senha.")
  .min(8, "A senha deve ter pelo menos 8 caracteres.")
  .max(200, "Senha muito longa.")
  .regex(/[A-Za-z]/, "A senha deve conter pelo menos uma letra.")
  .regex(/\d/, "A senha deve conter pelo menos um número.");

export const passwordResetRequestSchema = z
  .object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("Informe um e-mail válido.")
      .max(160, "E-mail muito longo."),
  })
  .strict();

export const passwordResetConfirmSchema = z
  .object({
    token: z.string().trim().min(1, "Token inválido.").max(260, "Token inválido."),
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Confirme a nova senha.").max(200, "Senha muito longa."),
  })
  .strict()
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "A confirmação de senha não confere.",
  });

export function parsePasswordResetRequestPayload(payload: unknown) {
  return passwordResetRequestSchema.safeParse(payload);
}

export function parsePasswordResetConfirmPayload(payload: unknown) {
  return passwordResetConfirmSchema.safeParse(payload);
}
