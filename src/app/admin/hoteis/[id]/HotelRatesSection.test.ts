import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  getCreateRateDisabledReason,
  getInitialRateRoomId,
  getSelectedRateRoom,
} from "./HotelRatesSection.rules";

const rooms = [{ id: "room-1", name: "Quarto de casal" }];

describe("HotelRatesSection", () => {
  it("desabilita Criar tarifa sem quartos", () => {
    expect(
      getCreateRateDisabledReason({
        canEdit: true,
        isPending: false,
        hasRooms: false,
        selectedRoom: null,
      })
    ).toBe("Selecione um quarto para criar tarifa.");
  });

  it("habilita Criar tarifa com quarto selecionado e permissão", () => {
    const selectedRoom = getSelectedRateRoom(rooms, "room-1");

    expect(
      getCreateRateDisabledReason({
        canEdit: true,
        isPending: false,
        hasRooms: true,
        selectedRoom,
      })
    ).toBe("");
  });

  it("seleciona automaticamente o primeiro quarto existente", () => {
    expect(getInitialRateRoomId(rooms)).toBe("room-1");
  });

  it("bloqueia usuário sem permissão", () => {
    expect(
      getCreateRateDisabledReason({
        canEdit: false,
        isPending: false,
        hasRooms: true,
        selectedRoom: rooms[0],
      })
    ).toBe("Você não tem permissão para editar este hotel.");
  });

  it("mantém o botão ligado ao formulário Nova tarifa", () => {
    const source = readFileSync(new URL("./HotelRatesSection.tsx", import.meta.url), "utf8");

    expect(source).toContain("setIsCreating((current) => !current)");
    expect(source).toContain('{isCreating ? "Fechar" : "Criar tarifa"}');
    expect(source).toContain('title="Nova tarifa"');
  });
});
