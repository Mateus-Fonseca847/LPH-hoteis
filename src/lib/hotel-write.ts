import { z } from "zod";

import {
  AuthenticationError,
  getRequiredSession,
  requireAuthenticatedRequestUser,
} from "@/lib/auth";
import { validateAdminTwoFactor } from "@/lib/auth/admin-security";
import { AuthorizationError, requireHotelEditAccess } from "@/lib/auth/authorization";
import { createApiErrorResponse } from "@/lib/errors/app-error";

const routeIdSchema = z
  .string()
  .trim()
  .regex(/^[a-zA-Z0-9_-]{10,191}$/, "Identificador inválido.");

const hotelRouteParamsSchema = z
  .object({
    hotelId: routeIdSchema,
  })
  .strict();

const hotelImageRouteParamsSchema = z
  .object({
    hotelId: routeIdSchema,
    imageId: routeIdSchema,
  })
  .strict();

const hotelRoomRouteParamsSchema = z
  .object({
    hotelId: routeIdSchema,
    roomId: routeIdSchema,
  })
  .strict();

export function parseHotelRouteParams(input: { hotelId: string }) {
  return hotelRouteParamsSchema.safeParse(input);
}

export function parseHotelImageRouteParams(input: { hotelId: string; imageId: string }) {
  return hotelImageRouteParamsSchema.safeParse(input);
}

export function parseHotelRoomRouteParams(input: { hotelId: string; roomId: string }) {
  return hotelRoomRouteParamsSchema.safeParse(input);
}

export async function requireAuthorizedHotelWrite(hotelId: string) {
  await getRequiredSession();

  const user = await requireAuthenticatedRequestUser();
  const twoFactorValidation = await validateAdminTwoFactor(user.id);

  if (!twoFactorValidation.success) {
    throw new AuthorizationError(twoFactorValidation.message);
  }

  await requireHotelEditAccess(user.id, hotelId);

  return user;
}

export function getRequestIpAddress(headersLike: Headers) {
  return (
    headersLike.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headersLike.get("x-real-ip") ||
    null
  );
}

export function createHotelWriteApiErrorResponse(error: unknown, fallbackMessage: string) {
  return createApiErrorResponse(error, fallbackMessage);
}

export { AuthenticationError, AuthorizationError };
