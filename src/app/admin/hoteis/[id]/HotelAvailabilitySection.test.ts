import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("HotelAvailabilitySection", () => {
  const source = readFileSync(new URL("./HotelAvailabilitySection.tsx", import.meta.url), "utf8");
  const actionSource = readFileSync(
    new URL("./room-availability-actions.ts", import.meta.url),
    "utf8"
  );

  it("renderiza um card por quarto e não mostra select global", () => {
    expect(source).toContain("roomCards.map");
    expect(source).toContain("admin-availability-room-card");
    expect(source).toContain("Abrir calendário");
    expect(source).toContain("Fechar calendário");
    expect(source).not.toContain("<select");
    expect(source).not.toContain("admin-availability-toolbar");
  });

  it("mostra estado vazio quando não há quartos", () => {
    expect(source).toContain("Cadastre um quarto antes de definir disponibilidade.");
  });

  it("mostra resumo mensal por quarto incluindo dias sem cadastro", () => {
    expect(source).toContain("disponíveis");
    expect(source).toContain("ocupados");
    expect(source).toContain("fechados");
    expect(source).toContain("sem cadastro");
  });

  it("passa o roomId correto para cada calendário", () => {
    expect(source).toContain("roomId={room.id}");
    expect(source).toContain("handleVisibleRangeChange(room.id");
    expect(source).toContain("onSavePeriod={handleCalendarSave}");
  });

  it("salva usando apenas o roomId do payload do calendário", () => {
    expect(source).toContain("saveRoomAvailabilityRangeAction(hotelId, payload.roomId, payload)");
    expect(source).toContain(
      "refreshRoomAvailability(\n          hotelId,\n          payload.roomId"
    );
    expect(source).toContain("Período marcado como ocupado.");
    expect(source).toContain("Período fechado para reservas.");
    expect(source).toContain("Período liberado para reservas.");
    expect(source).toContain("Não foi possível salvar a disponibilidade.");
  });

  it("mantém permissões pela action atual", () => {
    expect(actionSource).toContain("requireAuthorizedHotelWrite(hotelId)");
    expect(actionSource).toContain("hotelId,");
    expect(actionSource).toContain("Quarto inválido para esta disponibilidade.");
  });
});
