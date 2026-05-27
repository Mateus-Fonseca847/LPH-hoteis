import { describe, expect, it } from "vitest";

import {
  calculateStayNights,
  getRoomStayAvailabilityStatus,
  getRoomStayPriceEstimate,
  getStayDates,
} from "@/lib/stay-query";

const room = {
  capacity: 3,
  capacityAdults: 2,
  capacityChildren: 1,
  availability: [
    { date: "2026-07-10", availableUnits: 2, closed: false },
    { date: "2026-07-11", availableUnits: 1, closed: false },
  ],
  rates: [
    {
      id: "rate-1",
      name: "Flexivel",
      description: "Tarifa flexivel",
      priceCents: 35000,
      currency: "BRL",
      startDate: "2026-07-01",
      endDate: "2026-07-31",
      minNights: 1,
      maxGuests: 3,
      refundable: true,
      breakfastIncluded: true,
    },
  ],
};

describe("stay-query", () => {
  it("calcula noites e datas da estadia sem incluir checkout", () => {
    expect(calculateStayNights("2026-07-10", "2026-07-12")).toBe(2);
    expect(getStayDates("2026-07-10", "2026-07-12")).toEqual(["2026-07-10", "2026-07-11"]);
  });

  it("rejeita datas inválidas ou checkout sem noite", () => {
    expect(() => calculateStayNights("2026-02-30", "2026-03-02")).toThrow("Data inválida");
    expect(() => calculateStayNights("2026-07-10", "2026-07-10")).toThrow(
      "Check-out deve ser posterior"
    );
  });

  it("calcula preco total pela melhor tarifa compativel", () => {
    expect(getRoomStayPriceEstimate(room, "2026-07-10", "2026-07-12", 2, 1)).toMatchObject({
      nightlyPriceCents: 35000,
      totalPriceCents: 70000,
      nights: 2,
    });
  });

  it("marca indisponível quando alguma noite está fechada ou sem unidade", () => {
    expect(
      getRoomStayAvailabilityStatus(
        {
          ...room,
          availability: [
            { date: "2026-07-10", availableUnits: 1, closed: false },
            { date: "2026-07-11", availableUnits: 0, closed: false },
          ],
        },
        "2026-07-10",
        "2026-07-12",
        2,
        1
      )
    ).toBe("unavailable");
  });

  it("marca disponibilidade desconhecida quando falta dia configurado", () => {
    expect(
      getRoomStayAvailabilityStatus(
        {
          ...room,
          availability: [{ date: "2026-07-10", availableUnits: 1, closed: false }],
        },
        "2026-07-10",
        "2026-07-12",
        2,
        1
      )
    ).toBe("unknown");
  });
});
