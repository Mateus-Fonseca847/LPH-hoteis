import { z } from "zod";

function sanitizeName(value: string) {
  return value
    .replace(/[\u0000-\u001F\u007F]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

const passwordSchema = z
  .string()
  .min(1, "Informe a senha.")
  .min(8, "A senha deve ter pelo menos 8 caracteres.")
  .max(200, "Senha muito longa.")
  .regex(/[A-Z]/, "A senha deve conter pelo menos uma letra maiúscula.")
  .regex(/[a-z]/, "A senha deve conter pelo menos uma letra minúscula.")
  .regex(/\d/, "A senha deve conter pelo menos um número.");

export const signupPayloadSchema = z
  .object({
    name: z
      .string()
      .transform(sanitizeName)
      .pipe(
        z.string().min(2, "Informe seu nome.").max(120, "Nome deve ter no máximo 120 caracteres.")
      ),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("Informe um e-mail válido.")
      .max(160, "E-mail muito longo."),
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Confirme a senha.").max(200, "Senha muito longa."),
  })
  .strict()
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "As senhas informadas não conferem.",
  });

export type SignupPayload = z.infer<typeof signupPayloadSchema>;

export function parseSignupPayload(payload: unknown) {
  const result = signupPayloadSchema.safeParse(payload);

  if (!result.success) {
    return {
      success: false as const,
      error: result.error.issues[0]?.message || "Dados de cadastro inválidos.",
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
