"use server";

import { randomBytes } from "node:crypto";

import { HotelRole, Prisma } from "@prisma/client";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import {
  createAdminUserAuditLog,
  type AdminUserAuditSnapshot,
  type HotelPermissionAuditSnapshot,
} from "@/lib/audit/admin-user-audit";
import { requireAuthenticatedRequestUser, isAdminUser } from "@/lib/auth";
import { validateAdminTwoFactor } from "@/lib/auth/admin-security";
import { requireHotelAdminAccess } from "@/lib/auth/authorization";
import {
  AuthorizationError,
  ConflictError,
  getErrorMessage,
  NotFoundError,
  ValidationError,
} from "@/lib/errors/app-error";
import { getRequestIpAddress } from "@/lib/hotel-write";
import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/prisma";
import {
  parseAdminInvitationPayload,
  parseElevatedAdminInvitationPayload,
  parseHotelPermissionPayload,
} from "@/lib/validations/admin-user";

type ManagedHotelPermission = {
  id: string;
  hotelId: string;
  hotelName: string;
  role: "owner" | "admin" | "editor";
};

export type AccessibleAdministrator = {
  id: string;
  name: string;
  email: string;
  globalRole: "super_admin" | "hotel_admin" | "user";
  isActive: boolean;
  createdAt: string;
  permissions: ManagedHotelPermission[];
};

export type AdminUserActionState = {
  status: "idle" | "success" | "error";
  message: string;
  userId?: string;
  permissionId?: string;
};

type ScopedActorContext = {
  actor: Awaited<ReturnType<typeof requireAuthenticatedRequestUser>>;
  hotelId: string;
  hotelName: string;
  hotelRole: HotelRole | null;
};

const criticalHotelRoles = new Set<HotelRole>([HotelRole.owner, HotelRole.admin]);

function revalidateAdminUserPaths(hotelId?: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/hoteis");
  revalidatePath("/admin/administradores");

  if (hotelId) {
    revalidatePath(`/admin/hoteis/${hotelId}`);
  }
}

function mapUserSnapshot(user: {
  id: string;
  name: string;
  email: string;
  globalRole: "super_admin" | "hotel_admin" | "user";
  isActive: boolean;
}): AdminUserAuditSnapshot {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    globalRole: user.globalRole,
    isActive: user.isActive,
  };
}

function mapPermissionSnapshot(permission: {
  id: string;
  userId: string;
  hotelId: string;
  role: "owner" | "admin" | "editor";
}): HotelPermissionAuditSnapshot {
  return {
    id: permission.id,
    userId: permission.userId,
    hotelId: permission.hotelId,
    role: permission.role,
  };
}

async function getAuditIpAddress() {
  const requestHeaders = await headers();
  return getRequestIpAddress(requestHeaders);
}

async function requireAdminActor() {
  const actor = await requireAuthenticatedRequestUser();
  const twoFactorValidation = await validateAdminTwoFactor(actor.id);

  if (!twoFactorValidation.success) {
    throw new AuthorizationError(twoFactorValidation.message);
  }

  if (!isAdminUser(actor.globalRole)) {
    throw new AuthorizationError("Acesso administrativo negado.");
  }

  if ("isActive" in actor && actor.isActive === false) {
    throw new AuthorizationError("Usuário administrativo inativo.");
  }

  return actor;
}

function getManageableHotelRoles(
  globalRole: ScopedActorContext["actor"]["globalRole"],
  hotelRole: HotelRole | null
) {
  if (globalRole === "super_admin") {
    return [HotelRole.owner, HotelRole.admin, HotelRole.editor];
  }

  if (hotelRole === HotelRole.owner) {
    return [HotelRole.admin, HotelRole.editor];
  }

  if (hotelRole === HotelRole.admin) {
    return [HotelRole.editor];
  }

  return [];
}

async function getScopedActorContext(hotelId: string): Promise<ScopedActorContext> {
  const actor = await requireAdminActor();

  if (actor.globalRole === "super_admin") {
    const hotel = await prisma.hotel.findUnique({
      where: { id: hotelId },
      select: { id: true, name: true },
    });

    if (!hotel) {
      throw new NotFoundError("Hotel não encontrado.");
    }

    return {
      actor,
      hotelId: hotel.id,
      hotelName: hotel.name,
      hotelRole: null,
    };
  }

  let permission: Awaited<ReturnType<typeof requireHotelAdminAccess>>;

  try {
    permission = await requireHotelAdminAccess(actor.id, hotelId);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      throw new NotFoundError("Hotel não encontrado.");
    }

    throw error;
  }

  const hotel = await prisma.hotel.findUnique({
    where: { id: hotelId },
    select: { id: true, name: true },
  });

  if (!hotel) {
    throw new NotFoundError("Hotel não encontrado.");
  }

  return {
    actor,
    hotelId: hotel.id,
    hotelName: hotel.name,
    hotelRole: permission.hotelRole,
  };
}

function assertCanAssignHotelRole(context: ScopedActorContext, role: HotelRole) {
  const manageableRoles = getManageableHotelRoles(context.actor.globalRole, context.hotelRole);

  if (!manageableRoles.includes(role)) {
    throw new AuthorizationError("Você não pode atribuir esse papel neste hotel.");
  }
}

function assertCanCreateGlobalRole(
  actorGlobalRole: ScopedActorContext["actor"]["globalRole"],
  targetGlobalRole: "super_admin" | "hotel_admin" | "user"
) {
  if (targetGlobalRole === "super_admin" && actorGlobalRole !== "super_admin") {
    throw new AuthorizationError("Apenas super_admin pode criar outro super_admin.");
  }

  if (!isAdminUser(targetGlobalRole)) {
    throw new ConflictError("O usuário precisa ter papel global administrativo.");
  }
}

async function getAccessibleHotelIds(
  actorId: string,
  globalRole: "super_admin" | "hotel_admin" | "user"
) {
  if (globalRole === "super_admin") {
    const hotels = await prisma.hotel.findMany({
      select: { id: true },
    });

    return hotels.map((hotel) => hotel.id);
  }

  if (globalRole !== "hotel_admin") {
    return [];
  }

  const permissions = await prisma.hotelPermission.findMany({
    where: {
      userId: actorId,
      role: {
        in: [HotelRole.owner, HotelRole.admin],
      },
    },
    select: {
      hotelId: true,
    },
  });

  return permissions.map((permission) => permission.hotelId);
}

async function ensureAdminTargetUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      hotelPermissions: true,
    },
  });

  if (!user) {
    throw new NotFoundError("Usuário não encontrado.");
  }

  return user;
}

async function ensurePermissionBelongsToHotel(permissionId: string, hotelId: string) {
  const permission = await prisma.hotelPermission.findUnique({
    where: { id: permissionId },
  });

  if (!permission || permission.hotelId !== hotelId) {
    throw new NotFoundError("Vínculo não encontrado para este hotel.");
  }

  return permission;
}

async function preventLastSuperAdminDisable(tx: Prisma.TransactionClient, userId: string) {
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: {
      globalRole: true,
      isActive: true,
    },
  });

  if (!user || user.globalRole !== "super_admin" || !user.isActive) {
    return;
  }

  const otherActiveSuperAdmins = await tx.user.count({
    where: {
      globalRole: "super_admin",
      isActive: true,
      NOT: {
        id: userId,
      },
    },
  });

  if (otherActiveSuperAdmins === 0) {
    throw new ConflictError("Não é permitido desativar o último super_admin ativo.");
  }
}

async function preventSelfLastCriticalPermissionChange(
  tx: Prisma.TransactionClient,
  actorId: string,
  actorGlobalRole: "super_admin" | "hotel_admin" | "user",
  targetUserId: string,
  permissionId: string
) {
  if (actorGlobalRole === "super_admin" || actorId !== targetUserId) {
    return;
  }

  const remainingCriticalPermissions = await tx.hotelPermission.count({
    where: {
      userId: actorId,
      role: {
        in: [HotelRole.owner, HotelRole.admin],
      },
      NOT: {
        id: permissionId,
      },
    },
  });

  if (remainingCriticalPermissions === 0) {
    throw new ConflictError("Você não pode remover sua última permissão administrativa de hotel.");
  }
}

async function preventSelfLastCriticalPermissionDowngrade(
  tx: Prisma.TransactionClient,
  actorId: string,
  actorGlobalRole: "super_admin" | "hotel_admin" | "user",
  targetUserId: string,
  permissionId: string,
  currentRole: HotelRole,
  nextRole: HotelRole
) {
  if (
    actorGlobalRole === "super_admin" ||
    actorId !== targetUserId ||
    !criticalHotelRoles.has(currentRole) ||
    criticalHotelRoles.has(nextRole)
  ) {
    return;
  }

  const remainingCriticalPermissions = await tx.hotelPermission.count({
    where: {
      userId: actorId,
      role: {
        in: [HotelRole.owner, HotelRole.admin],
      },
      NOT: {
        id: permissionId,
      },
    },
  });

  if (remainingCriticalPermissions === 0) {
    throw new ConflictError("Você não pode perder sua última permissão administrativa de hotel.");
  }
}

export async function listAccessibleAdministratorsAction() {
  try {
    const actor = await requireAdminActor();
    const accessibleHotelIds = await getAccessibleHotelIds(actor.id, actor.globalRole);

    const users = await prisma.user.findMany({
      where:
        actor.globalRole === "super_admin"
          ? {
              OR: [
                { globalRole: { in: ["super_admin", "hotel_admin"] } },
                { hotelPermissions: { some: {} } },
              ],
            }
          : accessibleHotelIds.length > 0
            ? {
                hotelPermissions: {
                  some: {
                    hotelId: { in: accessibleHotelIds },
                  },
                },
              }
            : {
                id: actor.id,
              },
      select: {
        id: true,
        name: true,
        email: true,
        globalRole: true,
        isActive: true,
        createdAt: true,
        hotelPermissions: {
          where:
            actor.globalRole === "super_admin"
              ? undefined
              : {
                  hotelId: { in: accessibleHotelIds },
                },
          select: {
            id: true,
            hotelId: true,
            role: true,
            hotel: {
              select: {
                name: true,
              },
            },
          },
          orderBy: [{ hotelId: "asc" }],
        },
      },
      orderBy: [{ createdAt: "desc" }, { email: "asc" }],
    });

    const administrators: AccessibleAdministrator[] = users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      globalRole: user.globalRole,
      isActive: user.isActive,
      createdAt: user.createdAt.toISOString(),
      permissions: user.hotelPermissions.map((permission) => ({
        id: permission.id,
        hotelId: permission.hotelId,
        hotelName: permission.hotel.name,
        role: permission.role,
      })),
    }));

    return {
      status: "success" as const,
      message: "",
      administrators,
    };
  } catch (error) {
    return {
      status: "error" as const,
      message: getErrorMessage(error, "Não foi possível listar os administradores."),
      administrators: [] as AccessibleAdministrator[],
    };
  }
}

export async function createAdministratorAction(
  scopeHotelId: string,
  payload: unknown
): Promise<AdminUserActionState> {
  try {
    const context = await getScopedActorContext(scopeHotelId);
    const parsedPayload =
      context.actor.globalRole === "super_admin"
        ? parseElevatedAdminInvitationPayload(payload)
        : parseAdminInvitationPayload(payload);

    if (!parsedPayload.success) {
      throw new ValidationError(parsedPayload.error);
    }

    if (parsedPayload.data.hotelId !== context.hotelId) {
      throw new AuthorizationError("Hotel inválido para este convite.");
    }

    assertCanCreateGlobalRole(context.actor.globalRole, parsedPayload.data.globalRole);
    assertCanAssignHotelRole(context, parsedPayload.data.role as HotelRole);

    const existingUser = await prisma.user.findUnique({
      where: {
        email: parsedPayload.data.email,
      },
      select: {
        id: true,
      },
    });

    if (existingUser) {
      throw new ConflictError("Já existe um usuário com este e-mail.");
    }

    const ipAddress = await getAuditIpAddress();
    const passwordHash = await hashPassword(randomBytes(24).toString("hex"));

    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: parsedPayload.data.name,
          email: parsedPayload.data.email,
          passwordHash,
          globalRole: parsedPayload.data.globalRole,
          isActive: parsedPayload.data.isActive,
        },
      });

      const permission = await tx.hotelPermission.create({
        data: {
          userId: user.id,
          hotelId: context.hotelId,
          role: parsedPayload.data.role,
        },
      });

      await createAdminUserAuditLog({
        tx,
        userId: context.actor.id,
        hotelId: context.hotelId,
        action: "hotel.admin_user.created",
        previousValue: null,
        newValue: mapUserSnapshot(user),
        ipAddress,
      });

      await createAdminUserAuditLog({
        tx,
        userId: context.actor.id,
        hotelId: context.hotelId,
        action: "hotel.admin_permission.created",
        previousValue: null,
        newValue: mapPermissionSnapshot(permission),
        ipAddress,
      });

      return {
        userId: user.id,
        permissionId: permission.id,
      };
    });

    revalidateAdminUserPaths(context.hotelId);

    return {
      status: "success",
      message: "Administrador criado com sucesso.",
      userId: created.userId,
      permissionId: created.permissionId,
    };
  } catch (error) {
    return {
      status: "error",
      message: getErrorMessage(error, "Não foi possível criar o administrador."),
    };
  }
}

export async function addUserHotelPermissionAction(
  scopeHotelId: string,
  payload: unknown
): Promise<AdminUserActionState> {
  try {
    const context = await getScopedActorContext(scopeHotelId);
    const parsedPayload = parseHotelPermissionPayload(payload);

    if (!parsedPayload.success) {
      throw new ValidationError(parsedPayload.error);
    }

    if (parsedPayload.data.hotelId !== context.hotelId) {
      throw new AuthorizationError("Hotel inválido para este vínculo.");
    }

    assertCanAssignHotelRole(context, parsedPayload.data.role as HotelRole);

    const targetUser = await ensureAdminTargetUser(parsedPayload.data.userId);

    if (!isAdminUser(targetUser.globalRole)) {
      throw new ConflictError("O usuário precisa ter papel global administrativo.");
    }

    const existingPermission = await prisma.hotelPermission.findFirst({
      where: {
        userId: targetUser.id,
        hotelId: context.hotelId,
      },
      select: {
        id: true,
      },
    });

    if (existingPermission) {
      throw new ConflictError("O usuário já está vinculado a este hotel.");
    }

    const ipAddress = await getAuditIpAddress();

    const createdPermission = await prisma.$transaction(async (tx) => {
      const permission = await tx.hotelPermission.create({
        data: {
          userId: targetUser.id,
          hotelId: context.hotelId,
          role: parsedPayload.data.role,
        },
      });

      await createAdminUserAuditLog({
        tx,
        userId: context.actor.id,
        hotelId: context.hotelId,
        action: "hotel.admin_permission.created",
        previousValue: null,
        newValue: mapPermissionSnapshot(permission),
        ipAddress,
      });

      return permission;
    });

    revalidateAdminUserPaths(context.hotelId);

    return {
      status: "success",
      message: "Vínculo criado com sucesso.",
      userId: targetUser.id,
      permissionId: createdPermission.id,
    };
  } catch (error) {
    return {
      status: "error",
      message: getErrorMessage(error, "Não foi possível adicionar o vínculo do usuário."),
    };
  }
}

export async function updateHotelPermissionAction(
  scopeHotelId: string,
  permissionId: string,
  payload: unknown
): Promise<AdminUserActionState> {
  try {
    const context = await getScopedActorContext(scopeHotelId);
    const parsedPayload = parseHotelPermissionPayload(payload);

    if (!parsedPayload.success) {
      throw new ValidationError(parsedPayload.error);
    }

    if (parsedPayload.data.hotelId !== context.hotelId) {
      throw new AuthorizationError("Hotel inválido para esta alteração.");
    }

    const currentPermission = await ensurePermissionBelongsToHotel(permissionId, context.hotelId);

    if (parsedPayload.data.userId !== currentPermission.userId) {
      throw new AuthorizationError("Usuário inválido para este vínculo.");
    }

    assertCanAssignHotelRole(context, parsedPayload.data.role as HotelRole);

    if (
      context.actor.globalRole !== "super_admin" &&
      criticalHotelRoles.has(currentPermission.role)
    ) {
      throw new AuthorizationError("Você não pode alterar permissões críticas neste hotel.");
    }

    const ipAddress = await getAuditIpAddress();

    await prisma.$transaction(async (tx) => {
      await preventSelfLastCriticalPermissionDowngrade(
        tx,
        context.actor.id,
        context.actor.globalRole,
        currentPermission.userId,
        currentPermission.id,
        currentPermission.role,
        parsedPayload.data.role as HotelRole
      );

      const updatedPermission = await tx.hotelPermission.update({
        where: {
          id: currentPermission.id,
        },
        data: {
          role: parsedPayload.data.role,
        },
      });

      await createAdminUserAuditLog({
        tx,
        userId: context.actor.id,
        hotelId: context.hotelId,
        action: "hotel.admin_permission.updated",
        previousValue: mapPermissionSnapshot(currentPermission as HotelPermissionAuditSnapshot),
        newValue: mapPermissionSnapshot(updatedPermission),
        ipAddress,
      });
    });

    revalidateAdminUserPaths(context.hotelId);

    return {
      status: "success",
      message: "Permissão atualizada com sucesso.",
      permissionId: currentPermission.id,
    };
  } catch (error) {
    return {
      status: "error",
      message: getErrorMessage(error, "Não foi possível alterar a permissão."),
    };
  }
}

export async function removeUserHotelPermissionAction(
  scopeHotelId: string,
  permissionId: string
): Promise<AdminUserActionState> {
  try {
    const context = await getScopedActorContext(scopeHotelId);
    const currentPermission = await ensurePermissionBelongsToHotel(permissionId, context.hotelId);

    if (
      context.actor.globalRole !== "super_admin" &&
      criticalHotelRoles.has(currentPermission.role)
    ) {
      throw new AuthorizationError("Você não pode remover permissões críticas neste hotel.");
    }

    const ipAddress = await getAuditIpAddress();

    await prisma.$transaction(async (tx) => {
      await preventSelfLastCriticalPermissionChange(
        tx,
        context.actor.id,
        context.actor.globalRole,
        currentPermission.userId,
        currentPermission.id
      );

      await tx.hotelPermission.delete({
        where: {
          id: currentPermission.id,
        },
      });

      await createAdminUserAuditLog({
        tx,
        userId: context.actor.id,
        hotelId: context.hotelId,
        action: "hotel.admin_permission.removed",
        previousValue: mapPermissionSnapshot(currentPermission as HotelPermissionAuditSnapshot),
        newValue: null,
        ipAddress,
      });
    });

    revalidateAdminUserPaths(context.hotelId);

    return {
      status: "success",
      message: "Vínculo removido com sucesso.",
      permissionId,
    };
  } catch (error) {
    return {
      status: "error",
      message: getErrorMessage(error, "Não foi possível remover o vínculo do usuário."),
    };
  }
}

export async function toggleAdministrativeUserActiveAction(
  scopeHotelId: string,
  userId: string,
  isActive: boolean
): Promise<AdminUserActionState> {
  try {
    const context = await getScopedActorContext(scopeHotelId);

    if (context.actor.globalRole !== "super_admin") {
      throw new AuthorizationError("Apenas super_admin pode ativar ou desativar usuários.");
    }

    if (typeof isActive !== "boolean") {
      throw new ValidationError("Status de ativação inválido.");
    }

    const targetUser = await ensureAdminTargetUser(userId);
    const previousValue = mapUserSnapshot(targetUser);
    const ipAddress = await getAuditIpAddress();

    await prisma.$transaction(async (tx) => {
      if (!isActive) {
        await preventLastSuperAdminDisable(tx, targetUser.id);
      }

      const updatedUser = await tx.user.update({
        where: {
          id: targetUser.id,
        },
        data: {
          isActive,
        },
      });

      await createAdminUserAuditLog({
        tx,
        userId: context.actor.id,
        hotelId: context.hotelId,
        action: isActive ? "hotel.admin_user.activated" : "hotel.admin_user.deactivated",
        previousValue,
        newValue: mapUserSnapshot(updatedUser),
        ipAddress,
      });
    });

    revalidateAdminUserPaths(context.hotelId);

    return {
      status: "success",
      message: isActive ? "Usuário ativado com sucesso." : "Usuário desativado com sucesso.",
      userId,
    };
  } catch (error) {
    return {
      status: "error",
      message: getErrorMessage(error, "Não foi possível alterar o status do usuário."),
    };
  }
}
