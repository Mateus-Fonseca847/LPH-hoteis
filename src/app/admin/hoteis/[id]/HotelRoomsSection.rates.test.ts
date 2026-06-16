import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("HotelRoomsSection room rates placement", () => {
  const source = readFileSync(new URL("./HotelRoomsSection.tsx", import.meta.url), "utf8");

  it("renderiza tarifas dentro do card do quarto existente", () => {
    expect(source).toContain("RoomRatesSubsection");
    expect(source).toContain("roomId={room.id}");
  });

  it("mostra aviso de tarifas no formulario de quarto novo", () => {
    expect(source).toContain('mode === "create" ? <RoomRatesSubsection hotelId={hotelId} />');
  });
});
