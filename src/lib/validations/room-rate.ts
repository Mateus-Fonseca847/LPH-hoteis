import { z } from "zod";

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

const routeIdSchema = z
  .string()
  .trim()
  .regex(/^[a-zA-Z0-9_-]{10,191}$/, "Identificador do quarto inválido.");

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

const positiveIntField = (label: string, min: number, max: number) =>
  z
    .number({
      error: `${label} inválido.`,
    })
    .int(`${label} deve ser um número inteiro.`)
    .min(min, `${label} deve ser no mínimo ${min}.`)
    .max(max, `${label} deve ser no máximo ${max}.`);

const dateField = (label: string) =>
  z
    .string()
    .trim()
    .refine((value) => !Number.isNaN(Date.parse(value)), {
      message: `${label} inválida.`,
    });

const roomRateBaseSchema = z
  .object({
    roomId: routeIdSchema,
    name: textField("Nome", 3, 120),
    description: multilineField("Descrição", 10, 2000),
    priceCents: positiveIntField("Preço", 1, 100000000),
    currency: z
      .string()
      .trim()
      .transform((value) => value.toUpperCase())
      .pipe(z.literal("BRL", "Moeda inválida.")),
    startDate: dateField("Data inicial"),
    endDate: dateField("Data final"),
    minNights: positiveIntField("Mínimo de noites", 1, 365),
    maxGuests: positiveIntField("Máximo de hóspedes", 1, 20),
    refundable: z.boolean(),
    breakfastIncluded: z.boolean(),
    isActive: z.boolean(),
  })
  .strict()
  .refine((value) => new Date(value.endDate).getTime() >= new Date(value.startDate).getTime(), {
    message: "A data final não pode ser anterior à data inicial.",
    path: ["endDate"],
  });

export const createRoomRatePayloadSchema = roomRateBaseSchema;

export const updateRoomRatePayloadSchema = roomRateBaseSchema
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Informe ao menos um campo para atualizar.",
  })
  .refine(
    (value) => {
      if (!value.startDate || !value.endDate) {
        return true;
      }

      return new Date(value.endDate).getTime() >= new Date(value.startDate).getTime();
    },
    {
      message: "A data final não pode ser anterior à data inicial.",
      path: ["endDate"],
    }
  );

export type CreateRoomRatePayload = z.infer<typeof createRoomRatePayloadSchema>;
export type UpdateRoomRatePayload = z.infer<typeof updateRoomRatePayloadSchema>;

export function parseCreateRoomRatePayload(payload: unknown) {
  const result = createRoomRatePayloadSchema.safeParse(payload);

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

export function parseUpdateRoomRatePayload(payload: unknown) {
  const result = updateRoomRatePayloadSchema.safeParse(payload);

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
