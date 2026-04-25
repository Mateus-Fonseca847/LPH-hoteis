import { prisma } from "@/lib/prisma";

export const authenticatedUserSelect = {
  id: true,
  name: true,
  email: true,
  globalRole: true,
  twoFactorEnabled: true,
} as const;

export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: {
      email: email.toLowerCase().trim(),
    },
  });
}

export async function getCurrentUser() {
  const authModule = await import("@/lib/auth");
  return authModule.getAuthenticatedUser();
}
