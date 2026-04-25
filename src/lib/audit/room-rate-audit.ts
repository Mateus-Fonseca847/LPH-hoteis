import { Prisma } from "@prisma/client";

export type RoomRateAuditSnapshot = {
  id: string;
  roomId: string;
  name: string;
  description: string;
  priceCents: number;
  currency: string;
  startDate: string;
  endDate: string;
  minNights: number;
  maxGuests: number;
  refundable: boolean;
  breakfastIncluded: boolean;
  isActive: boolean;
};

type CreateRoomRateAuditLogInput = {
  tx: Prisma.TransactionClient;
  userId: string;
  hotelId: string;
  action: string;
  previousValue?: RoomRateAuditSnapshot | null;
  newValue?: RoomRateAuditSnapshot | null;
  ipAddress?: string | null;
};

function pickChangedValues(
  previousValue: RoomRateAuditSnapshot | null,
  newValue: RoomRateAuditSnapshot | null
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

  for (const key of Object.keys(previousValue) as Array<keyof RoomRateAuditSnapshot>) {
    const previousSerialized = JSON.stringify(previousValue[key]);
    const nextSerialized = JSON.stringify(newValue[key]);

    if (previousSerialized !== nextSerialized) {
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

export async function createRoomRateAuditLog({
  tx,
  userId,
  hotelId,
  action,
  previousValue,
  newValue,
  ipAddress,
}: CreateRoomRateAuditLogInput) {
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
