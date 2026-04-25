import { redirect } from "next/navigation";

import { getAuthSession, type AuthSessionPayload } from "@/lib/auth/session";
import { authenticatedUserSelect } from "@/lib/auth/user";
import { prisma } from "@/lib/prisma";

export class AuthenticationError extends Error {
  constructor(message = "Usuário não autenticado.") {
    super(message);
    this.name = "AuthenticationError";
  }
}

export class AdminAccessError extends Error {
  constructor(message = "Acesso administrativo negado.") {
    super(message);
    this.name = "AdminAccessError";
  }
}

export type AuthenticatedUser = Awaited<ReturnType<typeof getAuthenticatedUser>>;

export function isAdminUser(role: "super_admin" | "hotel_admin" | "user") {
  return role === "super_admin" || role === "hotel_admin";
}

export function isFullyAuthenticatedSession(session: AuthSessionPayload | null) {
  if (!session?.sub) {
    return false;
  }

  return isAdminUser(session.globalRole as "super_admin" | "hotel_admin" | "user")
    ? session.twoFactorVerified === true
    : true;
}

export async function getAuthenticatedUser() {
  const session = await getAuthSession();

  if (!isFullyAuthenticatedSession(session)) {
    return null;
  }
  if (!session) {
    return null;
  }

  return prisma.user.findUnique({
    where: {
      id: session.sub,
    },
    select: authenticatedUserSelect,
  });
}

export async function getRequiredSession(): Promise<AuthSessionPayload> {
  const session = await getAuthSession();

  if (!isFullyAuthenticatedSession(session)) {
    throw new AuthenticationError();
  }
  if (!session) {
    throw new AuthenticationError();
  }

  return session;
}

export async function getPendingAuthSession() {
  const session = await getAuthSession();

  if (!session?.sub) {
    return null;
  }

  return session;
}

export async function requirePendingAuthSession() {
  const session = await getPendingAuthSession();

  if (!session) {
    throw new AuthenticationError();
  }

  return session;
}

export async function requireAuthenticatedUser(redirectTo?: string) {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirectToLogin(redirectTo);
  }

  return user;
}

export async function requireAuthenticatedRequestUser() {
  const user = await getAuthenticatedUser();

  if (!user) {
    throw new AuthenticationError();
  }

  return user;
}

export async function requireAdminRouteSession(redirectTo?: string) {
  const user = await requireAuthenticatedUser(redirectTo);

  if (!isAdminUser(user.globalRole)) {
    throw new AdminAccessError();
  }

  return user;
}

export function redirectToLogin(redirectTo?: string): never {
  const target = redirectTo ? `/login?redirectTo=${encodeURIComponent(redirectTo)}` : "/login";
  redirect(target);
}
