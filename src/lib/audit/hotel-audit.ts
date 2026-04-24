import type { Prisma } from "@prisma/client";

type HotelAuditSnapshot = {
  name: string;
  slug: string;
  shortDescription: string;
  fullDescription: string;
  city: string;
  state: string;
  address: string;
  phone: string;
  email: string;
  whatsapp: string;
  coverImageUrl: string;
  checkInTime: string;
  checkOutTime: string;
  isPublished: boolean;
  images: { url: string; alt: string; position: number }[];
  amenities: { label: string; position: number }[];
  policies: { title: string; description: string; position: number }[];
};

type CreateHotelAuditLogInput = {
  tx: Prisma.TransactionClient;
  userId: string;
  hotelId: string;
  action: string;
  previousValue: HotelAuditSnapshot;
  newValue: HotelAuditSnapshot;
  ipAddress?: string | null;
};

function normalizeSnapshot(snapshot: HotelAuditSnapshot) {
  return {
    ...snapshot,
    images: [...snapshot.images].sort((a, b) => a.position - b.position),
    amenities: [...snapshot.amenities].sort((a, b) => a.position - b.position),
    policies: [...snapshot.policies].sort((a, b) => a.position - b.position),
  };
}

function pickChangedValues(previousValue: HotelAuditSnapshot, newValue: HotelAuditSnapshot) {
  const changedFields: string[] = [];
  const previousChanged: Record<string, unknown> = {};
  const nextChanged: Record<string, unknown> = {};

  for (const key of Object.keys(previousValue) as Array<keyof HotelAuditSnapshot>) {
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

export async function createHotelAuditLog({
  tx,
  userId,
  hotelId,
  action,
  previousValue,
  newValue,
  ipAddress,
}: CreateHotelAuditLogInput) {
  const normalizedPrevious = normalizeSnapshot(previousValue);
  const normalizedNext = normalizeSnapshot(newValue);
  const { changedFields, previousChanged, nextChanged } = pickChangedValues(
    normalizedPrevious,
    normalizedNext
  );

  await tx.hotelAuditLog.create({
    data: {
      userId,
      hotelId,
      action,
      changedFields,
      previousValue: previousChanged as Prisma.InputJsonValue,
      newValue: nextChanged as Prisma.InputJsonValue,
      ipAddress: ipAddress ?? null,
    },
  });
}

export type { HotelAuditSnapshot };
