import { z } from "zod";

import { canonicalizeBedsValue, canonicalizeRoomAmenityLabels } from "@/lib/room-options";

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
    .int(`${label} deve ser um numero inteiro.`)
    .min(min, `${label} deve ser no mínimo ${min}.`)
    .max(max, `${label} deve ser no máximo ${max}.`);

const urlSchema = z.string().trim().url("URL invalida.").max(500, "URL muito longa.");

const roomBedSchema = z
  .string()
  .transform(sanitizeText)
  .superRefine((value, context) => {
    const result = canonicalizeBedsValue(value);

    if (!result.success) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: result.error,
      });
    }
  })
  .transform((value) => {
    const result = canonicalizeBedsValue(value);
    return result.success ? result.value : value;
  });

const roomAmenitySchema = textField("Comodidade do quarto", 2, 80);

const roomAmenitiesSchema = z
  .array(roomAmenitySchema)
  .min(1, "Adicione pelo menos uma comodidade.")
  .max(30, "Máximo de 30 comodidades.")
  .superRefine((values, context) => {
    const result = canonicalizeRoomAmenityLabels(values);

    if (!result.success) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: result.error,
      });
    }
  })
  .transform((values) => {
    const result = canonicalizeRoomAmenityLabels(values);
    return result.success ? result.value : values;
  });

const roomBaseSchema = z
  .object({
    name: textField("Nome", 3, 120),
    description: multilineField("Descrição", 10, 2000),
    imageUrl: urlSchema,
    capacityAdults: positiveIntField("Capacidade de adultos", 1, 20),
    capacityChildren: positiveIntField("Capacidade de crianças", 0, 20),
    beds: roomBedSchema,
    sizeM2: positiveIntField("Tamanho em m2", 1, 1000),
    amenities: roomAmenitiesSchema,
    isActive: z.boolean(),
  })
  .strict();

export const createHotelRoomPayloadSchema = roomBaseSchema;

export const updateHotelRoomPayloadSchema = roomBaseSchema
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Informe ao menos um campo para atualizar.",
  });

export type CreateHotelRoomPayload = z.infer<typeof createHotelRoomPayloadSchema>;
export type UpdateHotelRoomPayload = z.infer<typeof updateHotelRoomPayloadSchema>;

export function parseCreateHotelRoomPayload(payload: unknown) {
  const result = createHotelRoomPayloadSchema.safeParse(payload);

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

export function parseUpdateHotelRoomPayload(payload: unknown) {
  const result = updateHotelRoomPayloadSchema.safeParse(payload);

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
