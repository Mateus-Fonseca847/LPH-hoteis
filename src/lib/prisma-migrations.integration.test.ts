import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const shouldRunDatabaseTests = process.env.RUN_DATABASE_TESTS === "true";
const describeDatabase = shouldRunDatabaseTests ? describe : describe.skip;

describeDatabase("Prisma migrations against PostgreSQL", () => {
  const prisma = new PrismaClient();

  beforeAll(() => {
    expect(process.env.DATABASE_URL).toContain("postgresql://");
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("has the migrated core tables available", async () => {
    const rows = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN (
          'Hotel',
          'Reservation',
          'PaymentTransaction',
          'PaymentReconciliationLog',
          'ReservationOperationLog',
          '_prisma_migrations'
        )
      ORDER BY table_name
    `;

    expect(rows.map((row) => row.table_name).sort()).toEqual([
      "Hotel",
      "PaymentReconciliationLog",
      "PaymentTransaction",
      "Reservation",
      "ReservationOperationLog",
      "_prisma_migrations",
    ]);
  });
});
