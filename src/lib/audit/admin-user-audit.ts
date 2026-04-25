import { Prisma } from "@prisma/client";

type AdminUserAuditSnapshot = {
  id: string;
  name: string;
  email: string;
  globalRole: "super_admin" | "hotel_admin" | "user";
  isActive: boolean;
};

type HotelPermissionAuditSnapshot = {
  id: string;
  userId: string;
  hotelId: string;
  role: "owner" | "admin" | "editor";
};

type AdminUserAuditInput = {
  tx: Prisma.TransactionClient;
  userId: string;
  hotelId: string;
  action: string;
  previousValue?: AdminUserAuditSnapshot | HotelPermissionAuditSnapshot | null;
  newValue?: AdminUserAuditSnapshot | HotelPermissionAuditSnapshot | null;
  ipAddress?: string | null;
};

function pickChangedValues(
  previousValue: Record<string, unknown> | null | undefined,
  newValue: Record<string, unknown> | null | undefined
) {
  if (!previousValue && !newValue) {
    return {
      changedFields: [],
      previousChanged: null,
      nextChanged: null,
    };
  }

  if (!previousValue && newValue) {
    return {
      changedFields: Object.keys(newValue),
      previousChanged: null,
      nextChanged: newValue,
    };
  }

  if (previousValue && !newValue) {
    return {
      changedFields: Object.keys(previousValue),
      previousChanged: previousValue,
      nextChanged: null,
    };
  }

  if (!previousValue || !newValue) {
    return {
      changedFields: [],
      previousChanged: null,
      nextChanged: null,
    };
  }

  const changedFields: string[] = [];
  const previousChanged: Record<string, unknown> = {};
  const nextChanged: Record<string, unknown> = {};

  for (const key of Object.keys(previousValue)) {
    if (JSON.stringify(previousValue[key]) !== JSON.stringify(newValue[key])) {
      changedFields.push(key);
      previousChanged[key] = previousValue[key];
      nextChanged[key] = newValue[key];
    }
  }

  return {
    changedFields,
    previousChanged,
    nextChanged,
  };
}

export async function createAdminUserAuditLog({
  tx,
  userId,
  hotelId,
  action,
  previousValue,
  newValue,
  ipAddress,
}: AdminUserAuditInput) {
  const { changedFields, previousChanged, nextChanged } = pickChangedValues(
    previousValue ?? null,
    newValue ?? null
  );

  if (changedFields.length === 0) {
    return;
  }

  await tx.hotelAuditLog.create({
    data: {
      userId,
      hotelId,
      action,
      changedFields,
      previousValue: (previousChanged ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      newValue: (nextChanged ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      ipAddress: ipAddress ?? null,
    },
  });
}

export type { AdminUserAuditSnapshot, HotelPermissionAuditSnapshot };
