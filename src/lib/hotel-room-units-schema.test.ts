import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("HotelRoom units schema", () => {
  it("adiciona quantidade base de unidades no quarto com default 1", () => {
    const schema = readFileSync(new URL("../../prisma/schema.prisma", import.meta.url), "utf8");
    const migration = readFileSync(
      new URL(
        "../../prisma/migrations/20260617113000_add_hotel_room_units/migration.sql",
        import.meta.url
      ),
      "utf8"
    );

    expect(schema).toContain("units            Int                @default(1)");
    expect(migration).toContain(
      'ALTER TABLE "HotelRoom" ADD COLUMN "units" INTEGER NOT NULL DEFAULT 1'
    );
  });
});
