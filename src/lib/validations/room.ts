import { z } from "zod";

import { getZodErrorMessage } from "@/lib/errorMessages";
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
    .int(`${label} deve ser um número inteiro.`)
    .min(min, `${label} deve ser no mínimo ${min}.`)
    .max(max, `${label} deve ser no máximo ${max}.`);

const urlSchema = z.string().trim().url("URL inválida.").max(500, "URL muito longa.");
const optionalUrlSchema = z
  .string()
  .trim()
  .max(500, "URL muito longa.")
  .refine((value) => !value || z.url().safeParse(value).success, "URL inválida.");

const roomImageSchema = z
  .object({
    id: z.string().trim().min(1).optional(),
    url: urlSchema,
    alt: textField("Texto alternativo da imagem", 2, 140),
    position: z.number().int().min(0).max(200),
  })
  .strict();

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

const roomImagesSchema = z
  .array(roomImageSchema)
  .max(20, "Máximo de 20 imagens.")
  .superRefine((images, context) => {
    const urls = new Set<string>();

    images.forEach((image, index) => {
      if (urls.has(image.url)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, "url"],
          message: "Não repita a mesma imagem.",
        });
      }

      urls.add(image.url);
    });
  });

const roomObjectSchema = z
  .object({
    name: textField("Nome", 3, 120),
    description: multilineField("Descrição", 10, 2000),
    imageUrl: optionalUrlSchema,
    images: roomImagesSchema.optional(),
    units: positiveIntField("Unidades", 1, 999),
    capacityAdults: positiveIntField("Capacidade de adultos", 1, 20),
    capacityChildren: positiveIntField("Capacidade de crianças", 0, 20),
    beds: roomBedSchema,
    sizeM2: positiveIntField("Tamanho em m2", 1, 1000),
    amenities: roomAmenitiesSchema,
    isActive: z.boolean(),
  })
  .strict();

export const createHotelRoomPayloadSchema = roomObjectSchema.refine(
  (value) => Boolean(value.imageUrl || value.images?.length),
  {
    message: "Adicione pelo menos uma imagem.",
    path: ["images"],
  }
);

export const updateHotelRoomPayloadSchema = roomObjectSchema
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
      error: getZodErrorMessage(result.error, "Verifique os dados do quarto."),
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
      error: getZodErrorMessage(result.error, "Verifique os dados do quarto."),
    };
  }

  return {
    success: true as const,
    data: result.data,
  };
}
