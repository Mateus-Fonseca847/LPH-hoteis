import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("AdminAuditPage", () => {
  it("consulta apenas logs de tarifas", () => {
    const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

    expect(source).toContain("HOTEL_RATE_AUDIT_ACTIONS");
    expect(source).toContain("buildRateAuditWhere");
    expect(source).toContain("Nenhuma alteração de tarifa registrada.");
    expect(source).not.toContain("hotel.profile.updated");
    expect(source).not.toContain("hotel.room_availability.updated");
    expect(source).not.toContain("hotel.admin_user.created");
  });
});
