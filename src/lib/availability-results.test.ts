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

  it("ordena disponíveis antes de desconhecidos e indisponíveis, depois por menor valor", () => {
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

  it("retorna unknown/null quando datas inválidas quebram disponibilidade ou preco", () => {
    const results = getCompatibleRoomAvailabilityResults({
      rooms: [baseRoom],
      checkIn: "2026-07-10",
      checkOut: "data-inválida",
      adults: 2,
      children: 1,
    });

    expect(results[0].availabilityStatus).toBe("unknown");
    expect(results[0].priceEstimate).toBeNull();
  });

  it("descarta quarto com capacidade configurada de forma inválida", () => {
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

  it("marcar período ocupado bloqueia reserva via availableUnits igual a zero", () => {
    const results = getCompatibleRoomAvailabilityResults({
      rooms: [
        {
          ...baseRoom,
          availability: [
            { date: "2026-07-10", availableUnits: 0, closed: false },
            { date: "2026-07-11", availableUnits: 0, closed: false },
          ],
        },
      ],
      checkIn: "2026-07-10",
      checkOut: "2026-07-12",
      adults: 2,
      children: 1,
    });

    expect(results[0].availabilityStatus).toBe("unavailable");
  });

  it("marcar fechado bloqueia reserva via closed true", () => {
    const results = getCompatibleRoomAvailabilityResults({
      rooms: [
        {
          ...baseRoom,
          availability: [
            { date: "2026-07-10", availableUnits: 1, closed: true },
            { date: "2026-07-11", availableUnits: 1, closed: false },
          ],
        },
      ],
      checkIn: "2026-07-10",
      checkOut: "2026-07-12",
      adults: 2,
      children: 1,
    });

    expect(results[0].availabilityStatus).toBe("unavailable");
  });

  it("liberar período volta a permitir disponibilidade com tarifa compatível", () => {
    const results = getCompatibleRoomAvailabilityResults({
      rooms: [
        {
          ...baseRoom,
          availability: [
            { date: "2026-07-10", availableUnits: 2, closed: false },
            { date: "2026-07-11", availableUnits: 2, closed: false },
          ],
        },
      ],
      checkIn: "2026-07-10",
      checkOut: "2026-07-12",
      adults: 2,
      children: 1,
    });

    expect(results[0].availabilityStatus).toBe("available");
    expect(results[0].priceEstimate?.totalPriceCents).toBe(70000);
  });

  it("alterar disponibilidade de um quarto não afeta outro quarto", () => {
    const results = getCompatibleRoomAvailabilityResults({
      rooms: [
        {
          ...baseRoom,
          id: "ocupado",
          name: "Ocupado",
          availability: [
            { date: "2026-07-10", availableUnits: 0, closed: false },
            { date: "2026-07-11", availableUnits: 0, closed: false },
          ],
        },
        {
          ...baseRoom,
          id: "liberado",
          name: "Liberado",
          availability: [
            { date: "2026-07-10", availableUnits: 1, closed: false },
            { date: "2026-07-11", availableUnits: 1, closed: false },
          ],
        },
      ],
      checkIn: "2026-07-10",
      checkOut: "2026-07-12",
      adults: 2,
      children: 1,
    });

    expect(results.find((result) => result.room.id === "ocupado")?.availabilityStatus).toBe(
      "unavailable"
    );
    expect(results.find((result) => result.room.id === "liberado")?.availabilityStatus).toBe(
      "available"
    );
  });
});
