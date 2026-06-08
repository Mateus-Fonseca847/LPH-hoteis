"use server";

import { randomBytes } from "node:crypto";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { requireAuthenticatedRequestUser } from "@/lib/auth";
import { hashPassword } from "@/lib/auth/password";
import { sendHotelOwnerSignupApprovedEmail, sendHotelOwnerSignupRejectedEmail } from "@/lib/email";
import {
  AuthorizationError,
  ConflictError,
  getErrorMessage,
  NotFoundError,
  ValidationError,
} from "@/lib/errors/app-error";
import { prisma } from "@/lib/prisma";

export type HotelOwnerSignupReviewState = {
  status: "idle" | "success" | "error";
  message: string;
};

const initialPasswordBytes = 18;

async function requireSuperAdminActor() {
  const actor = await requireAuthenticatedRequestUser();

  if (actor.globalRole !== "super_admin") {
    throw new AuthorizationError("Apenas super_admin pode revisar solicitações de acesso.");
  }

  if (!actor.isActive) {
    throw new AuthorizationError("Usuário administrativo inativo.");
  }

  return actor;
}

function getReviewNote(formData: FormData) {
  const reviewNote = String(formData.get("reviewNote") ?? "")
    .replace(/[\u0000-\u001F\u007F]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

  if (reviewNote.length > 1000) {
    throw new ValidationError("Observação deve ter no máximo 1000 caracteres.");
  }

  return reviewNote || null;
}

function createTemporaryPassword() {
  return `${randomBytes(initialPasswordBytes).toString("base64url")}A1`;
}

function revalidateSignupRequestPaths() {
  revalidatePath("/admin");
  revalidatePath("/admin/solicitacoes-acesso");
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function rejectHotelOwnerSignupRequestAction(
  requestId: string,
  _previousState: HotelOwnerSignupReviewState,
  formData: FormData
): Promise<HotelOwnerSignupReviewState> {
  try {
    const actor = await requireSuperAdminActor();
    const reviewNote = getReviewNote(formData);
    const now = new Date();

    const updatedRequest = await prisma.$transaction(async (tx) => {
      const request = await tx.hotelOwnerSignupRequest.findUnique({
        where: { id: requestId },
        select: {
          id: true,
          status: true,
          email: true,
          responsibleName: true,
          hotelName: true,
        },
      });

      if (!request) {
        throw new NotFoundError("Solicitação não encontrada.");
      }

      if (request.status !== "pending") {
        throw new ConflictError("Somente solicitações pendentes podem ser rejeitadas.");
      }

      return tx.hotelOwnerSignupRequest.update({
        where: { id: request.id },
        data: {
          status: "rejected",
          reviewedAt: now,
          reviewedById: actor.id,
          reviewNote,
        },
        select: {
          email: true,
          responsibleName: true,
          hotelName: true,
        },
      });
    });

    await sendHotelOwnerSignupRejectedEmail({
      to: updatedRequest.email,
      responsibleName: updatedRequest.responsibleName,
      hotelName: updatedRequest.hotelName,
      reviewNote,
    });

    revalidateSignupRequestPaths();

    return {
      status: "success",
      message: "Solicitação rejeitada.",
    };
  } catch (error) {
    return {
      status: "error",
      message: getErrorMessage(error, "Não foi possível rejeitar a solicitação."),
    };
  }
}

export async function approveHotelOwnerSignupRequestAction(
  requestId: string,
  _previousState: HotelOwnerSignupReviewState,
  formData: FormData
): Promise<HotelOwnerSignupReviewState> {
  const temporaryPassword = createTemporaryPassword();

  try {
    const actor = await requireSuperAdminActor();
    const reviewNote = getReviewNote(formData);
    const passwordHash = await hashPassword(temporaryPassword);
    const now = new Date();

    const approvedRequest = await prisma.$transaction(async (tx) => {
      const request = await tx.hotelOwnerSignupRequest.findUnique({
        where: { id: requestId },
        select: {
          id: true,
          responsibleName: true,
          email: true,
          hotelName: true,
          status: true,
        },
      });

      if (!request) {
        throw new NotFoundError("Solicitação não encontrada.");
      }

      if (request.status !== "pending") {
        throw new ConflictError("Somente solicitações pendentes podem ser aprovadas.");
      }

      const existingUser = await tx.user.findUnique({
        where: { email: request.email },
        select: { id: true },
      });

      if (existingUser) {
        throw new ConflictError("Já existe usuário com este e-mail.");
      }

      const user = await tx.user.create({
        data: {
          name: request.responsibleName,
          email: request.email,
          passwordHash,
          globalRole: "hotel_admin",
          isActive: true,
          emailTwoFactorEnabled: false,
        },
        select: {
          id: true,
          email: true,
          name: true,
          globalRole: true,
        },
      });

      const updatedRequest = await tx.hotelOwnerSignupRequest.update({
        where: { id: request.id },
        data: {
          status: "approved",
          reviewedAt: now,
          reviewedById: actor.id,
          reviewNote,
          createdUserId: user.id,
        },
        select: {
          email: true,
          responsibleName: true,
          hotelName: true,
          createdUserId: true,
        },
      });

      if (user.globalRole !== "hotel_admin") {
        throw new AuthorizationError("Papel administrativo inválido.");
      }

      return updatedRequest;
    });

    await sendHotelOwnerSignupApprovedEmail({
      to: approvedRequest.email,
      responsibleName: approvedRequest.responsibleName,
      hotelName: approvedRequest.hotelName,
      temporaryPassword,
    });

    revalidateSignupRequestPaths();

    return {
      status: "success",
      message: "Solicitação aprovada e hotel_admin criado.",
    };
  } catch (error) {
    return {
      status: "error",
      message: getErrorMessage(
        isUniqueConstraintError(error)
          ? new ConflictError("Já existe usuário com este e-mail.")
          : error,
        "Não foi possível aprovar a solicitação."
      ),
    };
  }
}
