import { describe, expect, it } from "vitest";

import { calculateHotelCompleteness, getHotelCompletenessSelect } from "./hotel-completeness";

const completeHotel = {
  name: "Hotel LPH",
  shortDescription: "Hotel completo",
  fullDescription: "Hotel completo para testes.",
  address: "Rua Teste, 123",
  phone: "11999999999",
  email: "hotel@example.com",
  whatsapp: "11999999999",
  coverImageUrl: "https://cdn.example.com/hotel.webp",
  checkInTime: "14:00",
  checkOutTime: "12:00",
  images: [{ id: "image-1" }],
  amenities: [{ id: "amenity-1" }],
  policies: [{ id: "policy-1" }],
  rooms: [
    {
      units: 1,
      rates: [{ id: "rate-1" }],
      availability: [],
    },
  ],
};

describe("hotel completeness", () => {
  it("seleciona unidades do quarto para calcular disponibilidade padrao", () => {
    const select = getHotelCompletenessSelect(new Date(Date.UTC(2026, 6, 1)));

    expect(select.rooms.select).toMatchObject({
      units: true,
    });
  });

  it("hotel com quarto ativo units=1 sem disponibilidade futura passa no check", () => {
    const completeness = calculateHotelCompleteness(completeHotel);

    expect(completeness.pending).not.toContain("Disponibilidade futura");
    expect(completeness.percentage).toBe(100);
  });

  it("hotel com quarto ativo units=4 sem disponibilidade futura passa no check", () => {
    const completeness = calculateHotelCompleteness({
      ...completeHotel,
      rooms: [{ ...completeHotel.rooms[0], units: 4, availability: [] }],
    });

    expect(completeness.pending).not.toContain("Disponibilidade futura");
    expect(completeness.percentage).toBe(100);
  });

  it("hotel sem quarto ativo continua pendente", () => {
    const completeness = calculateHotelCompleteness({
      ...completeHotel,
      rooms: [],
    });

    expect(completeness.pending).toContain("Quartos ativos");
    expect(completeness.pending).toContain("Disponibilidade futura");
  });

  it("hotel com quarto ativo units=0 falha no check de disponibilidade", () => {
    const completeness = calculateHotelCompleteness({
      ...completeHotel,
      rooms: [{ ...completeHotel.rooms[0], units: 0, availability: [] }],
    });

    expect(completeness.pending).toContain("Disponibilidade futura");
  });

  it("hotel com disponibilidade futura positiva continua passando", () => {
    const completeness = calculateHotelCompleteness({
      ...completeHotel,
      rooms: [
        {
          ...completeHotel.rooms[0],
          units: 1,
          availability: [{ id: "availability-1" }],
        },
      ],
    });

    expect(completeness.pending).not.toContain("Disponibilidade futura");
  });

  it("hotel nao perde completude quando a data atual avanca e nao ha registro futuro", () => {
    const before = calculateHotelCompleteness({
      ...completeHotel,
      rooms: [{ ...completeHotel.rooms[0], units: 1, availability: [{ id: "old" }] }],
    });
    const after = calculateHotelCompleteness({
      ...completeHotel,
      rooms: [{ ...completeHotel.rooms[0], units: 1, availability: [] }],
    });

    expect(before.percentage).toBe(100);
    expect(after.percentage).toBe(100);
    expect(after.pending).not.toContain("Disponibilidade futura");
  });

  it("remove a queda para 92 quando apenas disponibilidade futura falhava", () => {
    const completeness = calculateHotelCompleteness({
      ...completeHotel,
      rooms: [{ ...completeHotel.rooms[0], units: 1, rates: [{ id: "rate-1" }], availability: [] }],
    });

    expect(completeness.percentage).toBe(100);
    expect(completeness.pending).toEqual([]);
  });

  it("mantem demais pendencias funcionando", () => {
    const completeness = calculateHotelCompleteness({
      ...completeHotel,
      name: "",
      rooms: [{ ...completeHotel.rooms[0], units: 1, rates: [], availability: [] }],
    });

    expect(completeness.pending).toContain("Nome");
    expect(completeness.pending).toContain("Tarifas ativas");
    expect(completeness.pending).not.toContain("Disponibilidade futura");
  });
});
