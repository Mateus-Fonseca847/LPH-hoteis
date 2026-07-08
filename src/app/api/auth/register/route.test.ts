import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("POST /api/auth/register source", () => {
  it("mantem cadastro publico restrito a user comum", () => {
    const source = readFileSync(new URL("./route.ts", import.meta.url), "utf8");

    expect(source).toContain('globalRole: "user"');
    expect(source).toContain("isActive: true");
    expect(source).not.toContain('globalRole: "hotel_admin"');
    expect(source).not.toContain('globalRole: "super_admin"');
    expect(source).not.toContain("HotelOwnerSignupRequest");
    expect(source).not.toContain("hotelPermission");
  });
});
