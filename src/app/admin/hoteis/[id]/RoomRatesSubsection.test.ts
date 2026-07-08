import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("RoomRatesSubsection source", () => {
  const source = readFileSync(new URL("./RoomRatesSubsection.tsx", import.meta.url), "utf8");

  it("lista tarifas sempre usando o roomId do quarto atual", () => {
    expect(source).toContain("listRoomRatesAction(hotelId, roomId)");
    expect(source).toContain("roomId?: string");
    expect(source).toContain("<RoomRateFormCard");
    expect(source).toContain("roomId={roomId}");
  });

  it("renderiza tarifas em formato compacto antes de abrir edicao", () => {
    expect(source).toContain("admin-rate-compact-row");
    expect(source).toContain("formatPriceLabel(rate.priceCents)");
    expect(source).toContain("Abrir tarifa");
    expect(source).toContain("admin-rate-compact-badge");
    expect(source).not.toContain("formatRatePeriod(rate)");
    expect(source).not.toContain("Desativar");
  });

  it("mostra aviso quando o quarto ainda nao foi salvo", () => {
    expect(source).toContain("Salve o quarto antes de adicionar tarifas.");
  });

  it("mostra mensagem especifica quando o quarto ainda nao tem tarifas", () => {
    expect(source).toContain("Nenhuma tarifa cadastrada para este quarto.");
    expect(source).toContain("Cadastre tarifas dentro de cada quarto.");
  });

  it("renderiza a subseção de tarifas do quarto sem select global", () => {
    expect(source).toContain("Tarifas do quarto");
    expect(source).not.toContain("<select");
    expect(source).not.toContain("selectedRoomId");
  });
});
