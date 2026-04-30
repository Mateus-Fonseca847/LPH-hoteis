"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { isAdminUser, requireAdminRouteSession } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { AuthorizationError, getErrorMessage } from "@/lib/errors/app-error";
import { getRequestIpAddress } from "@/lib/hotel-write";
import { prisma } from "@/lib/prisma";

export type AccountSecurityActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

async function getAuditHotelId(userId: string, globalRole: "super_admin" | "hotel_admin" | "user") {
  if (globalRole === "super_admin") {
    const hotel = await prisma.hotel.findFirst({
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });

    return hotel?.id ?? null;
  }

  const permission = await prisma.hotelPermission.findFirst({
    where: { userId },
    select: { hotelId: true },
    orderBy: { createdAt: "asc" },
  });

  return permission?.hotelId ?? null;
}

async function createEmailTwoFactorAuditLog({
  tx,
  actorId,
  hotelId,
  previousEnabled,
  nextEnabled,
  ipAddress,
}: {
  tx: Prisma.TransactionClient;
  actorId: string;
  hotelId: string | null;
  previousEnabled: boolean;
  nextEnabled: boolean;
  ipAddress: string | null;
}) {
  if (!hotelId || previousEnabled === nextEnabled) {
    return;
  }

  await tx.hotelAuditLog.create({
    data: {
      userId: actorId,
      hotelId,
      action: nextEnabled ? "account.email_2fa.enabled" : "account.email_2fa.disabled",
      changedFields: ["emailTwoFactorEnabled"],
      previousValue: { emailTwoFactorEnabled: previousEnabled },
      newValue: { emailTwoFactorEnabled: nextEnabled },
      ipAddress,
    },
  });
}

export async function enableEmailTwoFactorAction(): Promise<AccountSecurityActionState> {
  try {
    const actor = await requireAdminRouteSession("/admin/seguranca");

    if (!isAdminUser(actor.globalRole)) {
      throw new AuthorizationError("Acesso administrativo negado.");
    }

    const requestHeaders = await headers();
    const ipAddress = getRequestIpAddress(requestHeaders);
    const auditHotelId = await getAuditHotelId(actor.id, actor.globalRole);

    await prisma.$transaction(async (tx) => {
      const currentUser = await tx.user.findUnique({
        where: { id: actor.id },
        select: { emailTwoFactorEnabled: true },
      });

      if (!currentUser) {
        throw new AuthorizationError("Usuário autenticado não encontrado.");
      }

      const updatedUser = await tx.user.update({
        where: { id: actor.id },
        data: { emailTwoFactorEnabled: true },
        select: { emailTwoFactorEnabled: true },
      });

      await createEmailTwoFactorAuditLog({
        tx,
        actorId: actor.id,
        hotelId: auditHotelId,
        previousEnabled: currentUser.emailTwoFactorEnabled,
        nextEnabled: updatedUser.emailTwoFactorEnabled,
        ipAddress,
      });
    });

    revalidatePath("/admin/seguranca");
    revalidatePath("/admin/auditoria");

    return {
      status: "success",
      message: "2FA por e-mail ativado para sua conta.",
    };
  } catch (error) {
    return {
      status: "error",
      message: getErrorMessage(error, "Não foi possível ativar o 2FA por e-mail."),
    };
  }
}

export async function disableEmailTwoFactorAction(): Promise<AccountSecurityActionState> {
  try {
    const actor = await requireAdminRouteSession("/admin/seguranca");

    if (isAdminUser(actor.globalRole)) {
      throw new AuthorizationError("Admins devem manter 2FA por e-mail ativo.");
    }

    return {
      status: "error",
      message: "Desativação indisponível para este perfil.",
    };
  } catch (error) {
    return {
      status: "error",
      message: getErrorMessage(error, "Não foi possível desativar o 2FA por e-mail."),
    };
  }
}

export async function sendTestEmailAction(): Promise<AccountSecurityActionState> {
  try {
    const actor = await requireAdminRouteSession("/admin/seguranca");

    if (!isAdminUser(actor.globalRole)) {
      throw new AuthorizationError("Acesso administrativo negado.");
    }

    const user = await prisma.user.findUnique({
      where: {
        id: actor.id,
        isActive: true,
      },
      select: {
        name: true,
        email: true,
      },
    });

    if (!user) {
      throw new AuthorizationError("Usuário autenticado não encontrado.");
    }

    await sendEmail({
      to: user.email,
      subject: "Teste de envio LPH",
      text: "Este é um teste de envio do sistema LPH.",
      html: `<p>Este é um teste de envio do sistema LPH.</p>`,
    });

    return {
      status: "success",
      message: `E-mail de teste enviado para ${user.email}.`,
    };
  } catch (error) {
    return {
      status: "error",
      message: getErrorMessage(error, "Não foi possível enviar o e-mail de teste."),
    };
  }
}
