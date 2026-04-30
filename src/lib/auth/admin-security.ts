import { getAuthSession } from "@/lib/auth/session";
import { isAdminUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function validateAdminTwoFactor(userId: string) {
  const session = await getAuthSession();

  if (!session?.sub || session.sub !== userId || session.twoFactorVerified !== true) {
    return {
      success: false as const,
      message: "Confirme o código de 2FA para continuar.",
    };
  }

  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      globalRole: true,
    },
  });

  if (!user) {
    return {
      success: false as const,
      message: "Usuário autenticado não encontrado.",
    };
  }

  if (!isAdminUser(user.globalRole)) {
    return { success: true as const };
  }

  return { success: true as const };
}
