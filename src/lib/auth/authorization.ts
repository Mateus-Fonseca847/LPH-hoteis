import { HotelRole } from "@prisma/client";

import { prisma } from "@/lib/prisma";

const editAllowedRoles: HotelRole[] = [HotelRole.owner, HotelRole.admin, HotelRole.editor];
const adminAllowedRoles: HotelRole[] = [HotelRole.owner, HotelRole.admin];

export class AuthorizationError extends Error {
  constructor(message = "Acesso negado.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

type PermissionContext = {
  globalRole: "super_admin" | "hotel_admin" | "user";
  hotelRole: HotelRole | null;
};

async function getPermissionContext(userId: string, hotelId: string): Promise<PermissionContext | null> {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      globalRole: true,
      hotelPermissions: {
        where: {
          hotelId,
        },
        select: {
          role: true,
        },
        take: 1,
      },
    },
  });

  if (!user) {
    return null;
  }

  return {
    globalRole: user.globalRole,
    hotelRole: user.hotelPermissions[0]?.role ?? null,
  };
}

export async function canViewHotelAdmin(userId: string, hotelId: string) {
  const context = await getPermissionContext(userId, hotelId);

  if (!context) {
    return false;
  }

  if (context.globalRole === "super_admin") {
    return true;
  }

  if (context.globalRole !== "hotel_admin") {
    return false;
  }

  return context.hotelRole !== null;
}

export async function canEditHotel(userId: string, hotelId: string) {
  const context = await getPermissionContext(userId, hotelId);

  if (!context) {
    return false;
  }

  if (context.globalRole === "super_admin") {
    return true;
  }

  if (context.globalRole !== "hotel_admin") {
    return false;
  }

  if (!context.hotelRole) {
    return false;
  }

  return editAllowedRoles.includes(context.hotelRole);
}

export async function requireHotelPermission(
  userId: string,
  hotelId: string,
  allowedRoles: HotelRole[]
) {
  const context = await getPermissionContext(userId, hotelId);

  if (!context) {
    throw new AuthorizationError();
  }

  if (context.globalRole === "super_admin") {
    return {
      globalRole: context.globalRole,
      hotelRole: context.hotelRole,
    };
  }

  if (context.globalRole !== "hotel_admin") {
    throw new AuthorizationError();
  }

  if (!context.hotelRole) {
    throw new AuthorizationError();
  }

  if (!allowedRoles.includes(context.hotelRole)) {
    throw new AuthorizationError();
  }

  return {
    globalRole: context.globalRole,
    hotelRole: context.hotelRole,
  };
}

export async function requireHotelAdminAccess(userId: string, hotelId: string) {
  return requireHotelPermission(userId, hotelId, adminAllowedRoles);
}

export async function requireHotelEditAccess(userId: string, hotelId: string) {
  return requireHotelPermission(userId, hotelId, editAllowedRoles);
}
