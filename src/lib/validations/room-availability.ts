import { z } from "zod";

const MAX_BULK_RANGE_DAYS = 180;

function sanitizeMultilineText(value: string) {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]+/g, " ")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

function getDateOnlyTimestamp(value: string) {
  const normalized = `${value.trim()}T00:00:00.000Z`;
  return new Date(normalized).getTime();
}

const routeIdSchema = z
  .string()
  .trim()
  .regex(/^[a-zA-Z0-9_-]{10,191}$/, "Identificador do quarto inválido.");

const dateField = (label: string) =>
  z
    .string()
    .trim()
    .refine((value) => /^\d{4}-\d{2}-\d{2}$/.test(value), {
      message: `${label} inválida.`,
    })
    .refine((value) => !Number.isNaN(getDateOnlyTimestamp(value)), {
      message: `${label} inválida.`,
    });

const nonNegativeIntField = (label: string, max: number) =>
  z
    .number({
      error: `${label} inválido.`,
    })
    .int(`${label} deve ser um número inteiro.`)
    .min(0, `${label} não pode ser negativo.`)
    .max(max, `${label} deve ser no máximo ${max}.`);

const noteField = z
  .string()
  .transform(sanitizeMultilineText)
  .pipe(z.string().max(1000, "Observação deve ter no máximo 1000 caracteres."))
  .optional();

const roomAvailabilityShape = {
  roomId: routeIdSchema,
  date: dateField("Data"),
  totalUnits: nonNegativeIntField("Total de unidades", 10000),
  availableUnits: nonNegativeIntField("Unidades disponíveis", 10000),
  closed: z.boolean(),
  note: noteField,
} satisfies z.ZodRawShape;

const roomAvailabilityObjectSchema = z.object(roomAvailabilityShape).strict();

export const createRoomAvailabilityPayloadSchema = roomAvailabilityObjectSchema.refine(
  (value) => value.availableUnits <= value.totalUnits,
  {
    message: "Unidades disponíveis não podem ser maiores que o total de unidades.",
    path: ["availableUnits"],
  }
);

export const updateRoomAvailabilityPayloadSchema = roomAvailabilityObjectSchema
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Informe ao menos um campo para atualizar.",
  })
  .refine(
    (value) => {
      if (value.totalUnits === undefined || value.availableUnits === undefined) {
        return true;
      }

      return value.availableUnits <= value.totalUnits;
    },
    {
      message: "Unidades disponíveis não podem ser maiores que o total de unidades.",
      path: ["availableUnits"],
    }
  );

export const bulkRoomAvailabilityPayloadSchema = z
  .object({
    roomId: routeIdSchema,
    startDate: dateField("Data inicial"),
    endDate: dateField("Data final"),
    totalUnits: nonNegativeIntField("Total de unidades", 10000).optional(),
    availableUnits: nonNegativeIntField("Unidades disponíveis", 10000).optional(),
    closed: z.boolean().optional(),
    note: noteField,
  })
  .strict()
  .refine(
    (value) =>
      value.totalUnits !== undefined ||
      value.availableUnits !== undefined ||
      value.closed !== undefined ||
      value.note !== undefined,
    {
      message: "Informe ao menos um campo para edição em lote.",
    }
  )
  .refine((value) => getDateOnlyTimestamp(value.endDate) >= getDateOnlyTimestamp(value.startDate), {
    message: "A data final não pode ser anterior à data inicial.",
    path: ["endDate"],
  })
  .refine(
    (value) =>
      Math.floor(
        (getDateOnlyTimestamp(value.endDate) - getDateOnlyTimestamp(value.startDate)) / 86400000
      ) <= MAX_BULK_RANGE_DAYS,
    {
      message: `O intervalo de datas não pode ultrapassar ${MAX_BULK_RANGE_DAYS} dias.`,
      path: ["endDate"],
    }
  )
  .refine(
    (value) => {
      if (value.totalUnits === undefined || value.availableUnits === undefined) {
        return true;
      }

      return value.availableUnits <= value.totalUnits;
    },
    {
      message: "Unidades disponíveis não podem ser maiores que o total de unidades.",
      path: ["availableUnits"],
    }
  );

export const roomAvailabilityIntervalPayloadSchema = z
  .object({
    roomId: routeIdSchema,
    startDate: dateField("Data inicial"),
    endDate: dateField("Data final"),
  })
  .strict()
  .refine((value) => getDateOnlyTimestamp(value.endDate) >= getDateOnlyTimestamp(value.startDate), {
    message: "A data final não pode ser anterior à data inicial.",
    path: ["endDate"],
  })
  .refine(
    (value) =>
      Math.floor(
        (getDateOnlyTimestamp(value.endDate) - getDateOnlyTimestamp(value.startDate)) / 86400000
      ) <= MAX_BULK_RANGE_DAYS,
    {
      message: `O intervalo de datas não pode ultrapassar ${MAX_BULK_RANGE_DAYS} dias.`,
      path: ["endDate"],
    }
  );

export type CreateRoomAvailabilityPayload = z.infer<typeof createRoomAvailabilityPayloadSchema>;
export type UpdateRoomAvailabilityPayload = z.infer<typeof updateRoomAvailabilityPayloadSchema>;
export type BulkRoomAvailabilityPayload = z.infer<typeof bulkRoomAvailabilityPayloadSchema>;
export type RoomAvailabilityIntervalPayload = z.infer<typeof roomAvailabilityIntervalPayloadSchema>;

export function parseCreateRoomAvailabilityPayload(payload: unknown) {
  const result = createRoomAvailabilityPayloadSchema.safeParse(payload);

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

export function parseUpdateRoomAvailabilityPayload(payload: unknown) {
  const result = updateRoomAvailabilityPayloadSchema.safeParse(payload);

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

export function parseBulkRoomAvailabilityPayload(payload: unknown) {
  const result = bulkRoomAvailabilityPayloadSchema.safeParse(payload);

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

export function parseRoomAvailabilityIntervalPayload(payload: unknown) {
  const result = roomAvailabilityIntervalPayloadSchema.safeParse(payload);

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
