import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  buildRatePayload,
  EMPTY_RATE_FORM,
  formatPriceFromCents,
  formatPriceLabel,
  getRateFormValues,
  parsePriceToCents,
  validateRateForm,
} from "./room-rate-form-helpers";

const validValues = {
  ...EMPTY_RATE_FORM,
  name: "Tarifa flexível",
  description: "Tarifa válida para o período informado.",
  price: "350,90",
  startDate: "2026-07-01",
  endDate: "2026-07-31",
  minNights: "2",
  maxGuests: "4",
};

describe("RoomRateFormCard helpers", () => {
  it("converte e formata preço mantendo a regra atual", () => {
    expect(parsePriceToCents("350,90")).toBe(35090);
    expect(formatPriceFromCents(35090)).toBe("350,90");
    expect(formatPriceLabel(35090)).toBe("R$ 350,90");
  });

  it("monta payload vinculado ao roomId correto", () => {
    expect(buildRatePayload("room_123456", validValues)).toEqual({
      roomId: "room_123456",
      name: "Tarifa flexível",
      description: "Tarifa válida para o período informado.",
      priceCents: 35090,
      currency: "BRL",
      startDate: "2026-07-01",
      endDate: "2026-07-31",
      minNights: 2,
      maxGuests: 4,
      refundable: false,
      breakfastIncluded: false,
      isActive: true,
    });
  });

  it("mantem validações de tarifa", () => {
    expect(validateRateForm("room_123456", validValues)).toEqual({});
    expect(
      validateRateForm("room_123456", {
        ...validValues,
        endDate: "2026-06-30",
      })
    ).toEqual({
      endDate: "A data final não pode ser anterior à data inicial.",
    });
  });

  it("preenche valores iniciais no formato do formulario de edicao", () => {
    expect(
      getRateFormValues({
        id: "rate_123456",
        roomId: "room_123456",
        name: "Tarifa flexível",
        description: "Tarifa válida.",
        priceCents: 25000,
        currency: "BRL",
        startDate: "2026-07-01T00:00:00.000Z",
        endDate: "2026-07-31T00:00:00.000Z",
        minNights: 1,
        maxGuests: 2,
        refundable: true,
        breakfastIncluded: true,
        isActive: true,
      })
    ).toMatchObject({
      price: "250,00",
      startDate: "2026-07-01",
      endDate: "2026-07-31",
      minNights: "1",
      maxGuests: "2",
    });
  });

  it("recebe hotelId, roomId, initialValues, callbacks e mode explicitamente", () => {
    const source = readFileSync(new URL("./RoomRateFormCard.tsx", import.meta.url), "utf8");

    expect(source).toContain("hotelId: string");
    expect(source).toContain("roomId: string");
    expect(source).toContain("initialValues?: RateFormValues");
    expect(source).toContain("mode: RateFormMode");
    expect(source).toContain("onSuccess:");
    expect(source).toContain("onError:");
  });
});
