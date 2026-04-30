import { z } from "zod";

const PAYMENT_PROVIDERS = ["manual", "mercado_pago"] as const;

function sanitizeText(value: string) {
  return value
    .replace(/[\u0000-\u001F\u007F]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

const optionalText = (max: number) =>
  z
    .string()
    .transform(sanitizeText)
    .pipe(z.string().max(max))
    .transform((value) => (value ? value : null));

export const paymentSettingsPayloadSchema = z
  .object({
    provider: z.enum(PAYMENT_PROVIDERS, "Provedor inválido."),
    isEnabled: z.boolean(),
    receiverLabel: z
      .string()
      .transform(sanitizeText)
      .pipe(
        z
          .string()
          .min(3, "Identificação do recebedor deve ter pelo menos 3 caracteres.")
          .max(120, "Identificação do recebedor deve ter no máximo 120 caracteres.")
      ),
    publicKey: optionalText(240),
    accessToken: optionalText(500),
    pixKey: optionalText(160),
    payoutDocument: optionalText(40),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.provider === "mercado_pago" && value.isEnabled && !value.publicKey) {
      ctx.addIssue({
        code: "custom",
        path: ["publicKey"],
        message: "Informe a public key de teste do Mercado Pago para ativar.",
      });
    }
  });

export type PaymentSettingsPayload = z.infer<typeof paymentSettingsPayloadSchema>;

export function parsePaymentSettingsFormData(formData: FormData) {
  const result = paymentSettingsPayloadSchema.safeParse({
    provider: String(formData.get("provider") ?? ""),
    isEnabled: formData.get("isEnabled") === "on",
    receiverLabel: String(formData.get("receiverLabel") ?? ""),
    publicKey: String(formData.get("publicKey") ?? ""),
    accessToken: String(formData.get("accessToken") ?? ""),
    pixKey: String(formData.get("pixKey") ?? ""),
    payoutDocument: String(formData.get("payoutDocument") ?? ""),
  });

  if (!result.success) {
    return {
      success: false as const,
      error: result.error.issues[0]?.message || "Configuração de pagamento inválida.",
    };
  }

  return {
    success: true as const,
    data: result.data,
  };
}
