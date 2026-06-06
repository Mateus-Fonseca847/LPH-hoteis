import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("AdminAuditDetailPage", () => {
  it("restringe o detalhe a logs de tarifa", () => {
    const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

    expect(source).toContain("HOTEL_RATE_AUDIT_ACTIONS");
    expect(source).toContain("in: [...HOTEL_RATE_AUDIT_ACTIONS]");
    expect(source).not.toContain("hotel.profile.updated");
    expect(source).not.toContain("hotel.room_availability.updated");
  });
});
