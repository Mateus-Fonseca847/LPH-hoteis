import { describe, expect, it } from "vitest";

import {
  formatRoomStartingPrice,
  getCompatibleRoomAvailabilityResults,
  getRoomAvailabilityLabel,
  type AvailabilityResultRoom,
} from "@/lib/availability-results";

const baseRoom: AvailabilityResultRoom = {
  id: "room-1",
  name: "Suite",
  description: "Suite",
  imageUrl: "/suite.webp",
  capacity: 3,
  capacityAdults: 2,
  capacityChildren: 1,
  beds: "Queen",
  sizeM2: 30,
  size: "30m2",
  amenities: [],
  lowestActiveRateCents: 35000,
  publicAvailabilityStatus: "available",
  availability: [
    { date: "2026-07-10", availableUnits: 1, closed: false },
    { date: "2026-07-11", availableUnits: 1, closed: false },
  ],
  rates: [
    {
      id: "rate-1",
      name: "Flex",
      description: "Flex",
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

describe("availability results", () => {
  it("filtra quartos incompatíveis com ocupacao", () => {
    const results = getCompatibleRoomAvailabilityResults({
      rooms: [
        baseRoom,
        {
          ...baseRoom,
          id: "small",
          name: "Compacto",
          capacity: 1,
          capacityAdults: 1,
          capacityChildren: 0,
        },
      ],
      checkIn: "2026-07-10",
      checkOut: "2026-07-12",
      adults: 2,
      children: 1,
    });

    expect(results.map((result) => result.room.id)).toEqual(["room-1"]);
  });

  it("ordena disponiveis antes de desconhecidos e indisponiveis, depois por menor valor", () => {
    const results = getCompatibleRoomAvailabilityResults({
      rooms: [
        {
          ...baseRoom,
          id: "closed",
          name: "Fechado",
          availability: [
            { date: "2026-07-10", availableUnits: 0, closed: false },
            { date: "2026-07-11", availableUnits: 1, closed: false },
          ],
        },
        {
          ...baseRoom,
          id: "cheap",
          name: "Economica",
          lowestActiveRateCents: 25000,
          rates: [{ ...baseRoom.rates![0], id: "cheap-rate", priceCents: 25000 }],
        },
        {
          ...baseRoom,
          id: "unknown",
          name: "Sem grade",
          availability: [],
        },
        baseRoom,
      ],
      checkIn: "2026-07-10",
      checkOut: "2026-07-12",
      adults: 2,
      children: 1,
    });

    expect(results.map((result) => result.room.id)).toEqual([
      "cheap",
      "room-1",
      "unknown",
      "closed",
    ]);
  });

  it("formata labels de preco e disponibilidade", () => {
    expect(formatRoomStartingPrice(null)).toBe("Consultar valores");
    expect(formatRoomStartingPrice(25000)).toContain("A partir de");
    expect(getRoomAvailabilityLabel("available")).toBe("Disponível");
    expect(getRoomAvailabilityLabel("unavailable")).toBe("Indisponível");
    expect(getRoomAvailabilityLabel("unknown")).toBe("Consultar disponibilidade");
  });

  it("retorna unknown/null quando datas invalidas quebram disponibilidade ou preco", () => {
    const results = getCompatibleRoomAvailabilityResults({
      rooms: [baseRoom],
      checkIn: "2026-07-10",
      checkOut: "data-invalida",
      adults: 2,
      children: 1,
    });

    expect(results[0].availabilityStatus).toBe("unknown");
    expect(results[0].priceEstimate).toBeNull();
  });

  it("descarta quarto com capacidade configurada de forma invalida", () => {
    const results = getCompatibleRoomAvailabilityResults({
      rooms: [{ ...baseRoom, capacity: 0 }],
      checkIn: "2026-07-10",
      checkOut: "2026-07-12",
      adults: 2,
      children: 1,
    });

    expect(results).toEqual([]);
  });

  it("ordena quarto com valor calculado antes de quarto sem tarifa", () => {
    const results = getCompatibleRoomAvailabilityResults({
      rooms: [{ ...baseRoom, id: "sem-tarifa", name: "Sem tarifa", rates: [] }, baseRoom],
      checkIn: "2026-07-10",
      checkOut: "2026-07-12",
      adults: 2,
      children: 1,
    });

    expect(results.map((result) => result.room.id)).toEqual(["room-1", "sem-tarifa"]);
  });
});
