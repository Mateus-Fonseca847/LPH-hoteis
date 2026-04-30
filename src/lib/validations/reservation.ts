import { z } from "zod";

import { getGuestDocumentError, normalizeGuestDocument } from "@/lib/guest-document";

function sanitizeText(value: string) {
  return value
    .replace(/[\u0000-\u001F\u007F]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

const routeIdSchema = z
  .string()
  .trim()
  .regex(/^[a-zA-Z0-9_-]{10,191}$/, "Identificador inválido.");

const dateField = (label: string) =>
  z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, `${label} inválida.`);

const guestNameField = z
  .string()
  .transform(sanitizeText)
  .pipe(z.string().min(3, "Nome deve ter pelo menos 3 caracteres.").max(120));

const guestEmailField = z
  .string()
  .trim()
  .toLowerCase()
  .email("E-mail inválido.")
  .max(180, "E-mail deve ter no máximo 180 caracteres.");

const guestPhoneField = z
  .string()
  .transform(sanitizeText)
  .pipe(z.string().min(8, "Telefone deve ter pelo menos 8 caracteres.").max(30));

const guestsField = (label: string, min: number, max: number) =>
  z.number().int(`${label} deve ser inteiro.`).min(min).max(max);

const guestDocumentField = z
  .string()
  .transform(sanitizeText)
  .pipe(z.string().min(1, "Informe um CPF válido ou um passaporte válido.").max(40))
  .transform((value, context) => {
    const normalizedDocument = normalizeGuestDocument(value);

    if (!normalizedDocument) {
      context.addIssue({
        code: "custom",
        message: getGuestDocumentError(value),
      });

      return z.NEVER;
    }

    return normalizedDocument;
  });

export const paymentMethodSchema = z.enum(["pix", "credit_card", "debit_card", "boleto"], {
  error: "Forma de pagamento inválida.",
});

export const createReservationPayloadSchema = z
  .object({
    hotelId: routeIdSchema,
    roomId: routeIdSchema,
    guestName: guestNameField,
    guestEmail: guestEmailField,
    guestPhone: guestPhoneField,
    guestDocument: guestDocumentField,
    checkIn: dateField("Check-in"),
    checkOut: dateField("Check-out"),
    adults: guestsField("Adultos", 1, 10),
    children: guestsField("Crianças", 0, 10),
    paymentMethod: paymentMethodSchema,
  })
  .strict();

export type CreateReservationPayload = z.infer<typeof createReservationPayloadSchema>;

export function parseCreateReservationPayload(payload: unknown) {
  const result = createReservationPayloadSchema.safeParse(payload);

  if (!result.success) {
    return {
      success: false as const,
      error: result.error.issues[0]?.message || "Dados da reserva inválidos.",
    };
  }

  return {
    success: true as const,
    data: result.data,
  };
}
