import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("room-rate-actions audit", () => {
  it("registra auditoria ao criar, editar, ativar/desativar e remover tarifas", () => {
    const source = readFileSync(new URL("./room-rate-actions.ts", import.meta.url), "utf8");

    expect(source).toContain("createRoomRateAuditLog");
    expect(source).toContain('action: "hotel.room_rate.created"');
    expect(source).toContain('action: "hotel.room_rate.updated"');
    expect(source).toContain('"hotel.room_rate.activated"');
    expect(source).toContain('"hotel.room_rate.deactivated"');
    expect(source).toContain('action: "hotel.room_rate.removed"');
    expect(source).toContain("removeRoomRateAction");
    expect(source).toContain("priceCents");
  });
});
