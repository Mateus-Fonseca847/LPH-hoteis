import { AuthorizationError, NotFoundError } from "@/lib/errors/app-error";

type AdminGlobalRole = "super_admin" | "hotel_admin" | "user";

type AdminActor = {
  globalRole: AdminGlobalRole;
};

type AdminTargetUser = {
  globalRole: AdminGlobalRole;
};

export function canManageAdministrativeTarget(actor: AdminActor, target: AdminTargetUser) {
  if (actor.globalRole === "super_admin") {
    return true;
  }

  if (actor.globalRole === "hotel_admin") {
    return target.globalRole === "hotel_admin";
  }

  return false;
}

export function assertCanManageAdministrativeTarget(actor: AdminActor, target: AdminTargetUser) {
  if (canManageAdministrativeTarget(actor, target)) {
    return;
  }

  if (target.globalRole === "super_admin") {
    throw new NotFoundError("Usuário não encontrado.");
  }

  throw new AuthorizationError("Você não pode gerenciar este usuário.");
}
