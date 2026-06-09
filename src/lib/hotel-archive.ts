import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

let archiveColumnPromise: Promise<boolean> | null = null;

export async function hasHotelArchiveFields() {
  if (!archiveColumnPromise) {
    archiveColumnPromise = Promise.resolve()
      .then(
        () => prisma.$queryRaw<Array<{ column_name: string }>>`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'Hotel'
          AND column_name = 'isArchived'
      `
      )
      .then((rows) => rows.length > 0)
      .catch(() => false);
  }

  return archiveColumnPromise;
}

export async function getActiveHotelWhere(): Promise<Prisma.HotelWhereInput> {
  return (await hasHotelArchiveFields()) ? { isArchived: false } : {};
}

export async function getPublicHotelWhere(): Promise<Prisma.HotelWhereInput> {
  return {
    isPublished: true,
    ...(await getActiveHotelWhere()),
  };
}
