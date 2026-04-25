import { z } from "zod";

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

const userNameSchema = z
  .string()
  .transform(sanitizeText)
  .pipe(
    z
      .string()
      .min(2, "Nome deve ter pelo menos 2 caracteres.")
      .max(120, "Nome deve ter no máximo 120 caracteres.")
  );

const userEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("E-mail inválido.")
  .max(160, "E-mail deve ter no máximo 160 caracteres.");

const commonGlobalRoleSchema = z.enum(["hotel_admin", "user"], {
  error: "Papel global inválido.",
});

const elevatedGlobalRoleSchema = z.enum(["super_admin", "hotel_admin", "user"], {
  error: "Papel global inválido.",
});

const hotelRoleSchema = z.enum(["owner", "admin", "editor"], {
  error: "Papel do hotel inválido.",
});

export const adminUserPayloadSchema = z
  .object({
    name: userNameSchema,
    email: userEmailSchema,
    globalRole: commonGlobalRoleSchema,
    isActive: z.boolean(),
  })
  .strict();

export const elevatedAdminUserPayloadSchema = z
  .object({
    name: userNameSchema,
    email: userEmailSchema,
    globalRole: elevatedGlobalRoleSchema,
    isActive: z.boolean(),
  })
  .strict();

export const hotelPermissionPayloadSchema = z
  .object({
    userId: routeIdSchema,
    hotelId: routeIdSchema,
    role: hotelRoleSchema,
  })
  .strict();

export const adminInvitationPayloadSchema = z
  .object({
    name: userNameSchema,
    email: userEmailSchema,
    globalRole: commonGlobalRoleSchema,
    hotelId: routeIdSchema,
    role: hotelRoleSchema,
    isActive: z.boolean(),
  })
  .strict();

export const elevatedAdminInvitationPayloadSchema = z
  .object({
    name: userNameSchema,
    email: userEmailSchema,
    globalRole: elevatedGlobalRoleSchema,
    hotelId: routeIdSchema,
    role: hotelRoleSchema,
    isActive: z.boolean(),
  })
  .strict();

export type AdminUserPayload = z.infer<typeof adminUserPayloadSchema>;
export type ElevatedAdminUserPayload = z.infer<typeof elevatedAdminUserPayloadSchema>;
export type HotelPermissionPayload = z.infer<typeof hotelPermissionPayloadSchema>;
export type AdminInvitationPayload = z.infer<typeof adminInvitationPayloadSchema>;
export type ElevatedAdminInvitationPayload = z.infer<typeof elevatedAdminInvitationPayloadSchema>;

export function parseAdminUserPayload(payload: unknown) {
  const result = adminUserPayloadSchema.safeParse(payload);

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

export function parseElevatedAdminUserPayload(payload: unknown) {
  const result = elevatedAdminUserPayloadSchema.safeParse(payload);

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

export function parseHotelPermissionPayload(payload: unknown) {
  const result = hotelPermissionPayloadSchema.safeParse(payload);

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

export function parseAdminInvitationPayload(payload: unknown) {
  const result = adminInvitationPayloadSchema.safeParse(payload);

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

export function parseElevatedAdminInvitationPayload(payload: unknown) {
  const result = elevatedAdminInvitationPayloadSchema.safeParse(payload);

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
