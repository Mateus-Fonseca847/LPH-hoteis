import { Prisma } from "@prisma/client";

import { ConflictError, ValidationError } from "@/lib/errors/app-error";
import { prisma } from "@/lib/prisma";
import { parseHotelOwnerSignupPayload } from "@/lib/validations/hotel-owner-signup";

export const HOTEL_OWNER_SIGNUP_USER_EXISTS_MESSAGE = "Já existe usuário com este e-mail.";
export const HOTEL_OWNER_SIGNUP_PENDING_EXISTS_MESSAGE =
  "Já existe uma solicitação pendente para este e-mail.";

export type CreateHotelOwnerSignupRequestResult = {
  id: string;
  status: "pending" | "approved" | "rejected";
};

export async function userExistsByEmail(email: string) {
  const user = await prisma.user.findUnique({
    where: {
      email: email.trim().toLowerCase(),
    },
    select: {
      id: true,
    },
  });

  return Boolean(user);
}

export async function pendingHotelOwnerSignupRequestExistsByEmail(email: string) {
  const request = await prisma.hotelOwnerSignupRequest.findFirst({
    where: {
      email: email.trim().toLowerCase(),
      status: "pending",
    },
    select: {
      id: true,
    },
  });

  return Boolean(request);
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function createPendingHotelOwnerSignupRequest(
  payload: unknown
): Promise<CreateHotelOwnerSignupRequestResult> {
  const parsedPayload = parseHotelOwnerSignupPayload(payload);

  if (!parsedPayload.success) {
    throw new ValidationError(parsedPayload.error);
  }

  const data = parsedPayload.data;

  if (await userExistsByEmail(data.email)) {
    throw new ConflictError(HOTEL_OWNER_SIGNUP_USER_EXISTS_MESSAGE);
  }

  if (await pendingHotelOwnerSignupRequestExistsByEmail(data.email)) {
    throw new ConflictError(HOTEL_OWNER_SIGNUP_PENDING_EXISTS_MESSAGE);
  }

  try {
    const created = await prisma.hotelOwnerSignupRequest.create({
      data: {
        ...data,
        status: "pending",
      },
      select: {
        id: true,
        status: true,
      },
    });

    return {
      id: created.id,
      status: created.status,
    };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new ConflictError(HOTEL_OWNER_SIGNUP_PENDING_EXISTS_MESSAGE);
    }

    throw error;
  }
}
