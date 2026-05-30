import { describe, expect, it, vi } from "vitest";

import { parseHotelFormData } from "@/lib/validations/hotel";

vi.mock("@/lib/hotel-amenities", () => ({
  getCanonicalAmenityLabel: (label: string) => label,
}));

function makeHotelFormData(overrides: Record<string, string> = {}) {
  const formData = new FormData();
  const values = {
    name: "LPH Teste",
    slug: "lph-teste",
    shortDescription: "Hotel de teste para validação.",
    fullDescription: "Hotel de teste com descrição completa para validação administrativa.",
    city: "Santos",
    state: "SP",
    address: "Avenida Teste, 123",
    phone: "+55 13 99999-9999",
    email: "hotel@example.com",
    whatsapp: "+55 13 99999-9999",
    coverImageUrl: "https://example.com/capa.webp",
    gallery: "https://example.com/capa.webp|Capa do hotel",
    amenities: "Wi-Fi\nPiscina",
    policies: "Check-in|A partir das 14h",
    checkInTime: "14:00",
    checkOutTime: "12:00",
    ...overrides,
  };

  Object.entries(values).forEach(([key, value]) => {
    formData.set(key, value);
  });

  return formData;
}

describe("hotel form image URLs", () => {
  it("aceita URL externa manual para imagem", () => {
    const result = parseHotelFormData(makeHotelFormData());

    expect(result.success).toBe(true);
  });

  it("aceita caminho local legado criado por upload", () => {
    const localPath = "/uploads/hotels/hotel_123/123e4567-e89b-12d3-a456-426614174000-capa.webp";
    const result = parseHotelFormData(
      makeHotelFormData({
        coverImageUrl: localPath,
        gallery: `${localPath}|Capa do hotel`,
      })
    );

    expect(result.success).toBe(true);
  });

  it("rejeita caminho local fora de uploads de hotéis", () => {
    const result = parseHotelFormData(
      makeHotelFormData({
        coverImageUrl: "/uploads/../../package.json",
        gallery: "/uploads/../../package.json|Imagem inválida",
      })
    );

    expect(result.success).toBe(false);
  });
});
