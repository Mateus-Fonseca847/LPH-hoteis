import { Prisma } from "@prisma/client";

type HotelRoomAuditSnapshot = {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  capacityAdults: number;
  capacityChildren: number;
  beds: string;
  sizeM2: number | null;
  amenities: string[];
  isActive: boolean;
  capacity: number;
  size: string;
  priceFrom: string;
  isAvailable: boolean;
};

type CreateHotelRoomAuditLogInput = {
  tx: Prisma.TransactionClient;
  userId: string;
  hotelId: string;
  action: string;
  previousValue?: HotelRoomAuditSnapshot | null;
  newValue?: HotelRoomAuditSnapshot | null;
  ipAddress?: string | null;
};

function normalizeSnapshot(snapshot: HotelRoomAuditSnapshot | null | undefined) {
  if (!snapshot) {
    return null;
  }

  return {
    ...snapshot,
    amenities: [...snapshot.amenities].sort(),
  };
}

function pickChangedValues(
  previousValue: HotelRoomAuditSnapshot | null,
  newValue: HotelRoomAuditSnapshot | null
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

  for (const key of Object.keys(previousValue) as Array<keyof HotelRoomAuditSnapshot>) {
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

export async function createHotelRoomAuditLog({
  tx,
  userId,
  hotelId,
  action,
  previousValue,
  newValue,
  ipAddress,
}: CreateHotelRoomAuditLogInput) {
  const normalizedPrevious = normalizeSnapshot(previousValue);
  const normalizedNext = normalizeSnapshot(newValue);
  const { changedFields, previousChanged, nextChanged } = pickChangedValues(
    normalizedPrevious,
    normalizedNext
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

export type { HotelRoomAuditSnapshot };
