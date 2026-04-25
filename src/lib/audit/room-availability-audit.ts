import { Prisma } from "@prisma/client";

export type RoomAvailabilityAuditEntry = {
  id?: string;
  roomId: string;
  date: string;
  totalUnits: number;
  availableUnits: number;
  closed: boolean;
  note: string | null;
};

type CreateRoomAvailabilityAuditLogInput = {
  tx: Prisma.TransactionClient;
  userId: string;
  hotelId: string;
  action: string;
  previousValue?: RoomAvailabilityAuditEntry[] | null;
  newValue?: RoomAvailabilityAuditEntry[] | null;
  ipAddress?: string | null;
};

function normalizeEntries(entries: RoomAvailabilityAuditEntry[] | null | undefined) {
  if (!entries?.length) {
    return null;
  }

  return [...entries]
    .map((entry) => ({
      ...entry,
      note: entry.note ?? null,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function pickChangedValues(
  previousValue: RoomAvailabilityAuditEntry[] | null,
  newValue: RoomAvailabilityAuditEntry[] | null
) {
  const previousSerialized = JSON.stringify(previousValue ?? null);
  const nextSerialized = JSON.stringify(newValue ?? null);

  if (previousSerialized === nextSerialized) {
    return {
      changedFields: [] as string[],
      previousChanged: null,
      nextChanged: null,
    };
  }

  const changedFields = ["date", "totalUnits", "availableUnits", "closed", "note"];

  return {
    changedFields,
    previousChanged: previousValue,
    nextChanged: newValue,
  };
}

export async function createRoomAvailabilityAuditLog({
  tx,
  userId,
  hotelId,
  action,
  previousValue,
  newValue,
  ipAddress,
}: CreateRoomAvailabilityAuditLogInput) {
  const normalizedPrevious = normalizeEntries(previousValue);
  const normalizedNext = normalizeEntries(newValue);
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
