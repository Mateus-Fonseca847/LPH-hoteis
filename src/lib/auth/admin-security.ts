import { prisma } from "@/lib/prisma";

export async function validateAdminTwoFactor(userId: string) {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      twoFactorEnabled: true,
    },
  });

  if (!user) {
    return {
      success: false as const,
      message: "Usuário autenticado não encontrado.",
    };
  }

  if (!user.twoFactorEnabled) {
    return { success: true as const };
  }

  return { success: true as const };
}
