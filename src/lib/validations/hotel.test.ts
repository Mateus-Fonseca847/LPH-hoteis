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
    experiences: "",
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

  it("aceita coordenadas internas opcionais", () => {
    const result = parseHotelFormData(
      makeHotelFormData({
        latitude: "-23.550520",
        longitude: "-46.633308",
      })
    );

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.latitude).toBe(-23.55052);
      expect(result.data.longitude).toBe(-46.633308);
    }
  });

  it("rejeita latitude sem longitude", () => {
    const result = parseHotelFormData(
      makeHotelFormData({
        latitude: "-23.550520",
        longitude: "",
      })
    );

    expect(result.success).toBe(false);
  });
  it("rejeita hotel sem e-mail de contato", () => {
    const result = parseHotelFormData(
      makeHotelFormData({
        email: "",
      })
    );

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toContain("e-mail de contato do hotel");
    }
  });

  it("rejeita hotel com e-mail de contato inválido", () => {
    const result = parseHotelFormData(
      makeHotelFormData({
        email: "inválido",
      })
    );

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toContain("e-mail de contato válido");
    }
  });

  it("aceita hotel com e-mail de contato valido", () => {
    const result = parseHotelFormData(
      makeHotelFormData({
        email: "Reservas@Teste.com",
      })
    );

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.email).toBe("reservas@teste.com");
    }
  });

  it("aceita experiências próximas válidas", () => {
    const result = parseHotelFormData(
      makeHotelFormData({
        experiences: JSON.stringify([
          {
            title: "Parque linear",
            city: "Santos",
            state: "SP",
            shortDescription: "Passeio ao ar livre próximo ao hotel para famílias e descanso.",
            imageUrl: "https://example.com/experiencia.webp",
            imageAlt: "Parque próximo ao hotel",
            categories: ["Natureza", "Família"],
            preferences: ["crianças", "tranquilidade"],
            distanceText: "10 min de carro",
            isActive: true,
          },
        ]),
      })
    );

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.experiences).toHaveLength(1);
      expect(result.data.experiences[0]?.categories).toEqual(["Natureza", "Família"]);
    }
  });

  it("rejeita experiência sem categoria", () => {
    const result = parseHotelFormData(
      makeHotelFormData({
        experiences: JSON.stringify([
          {
            title: "Parque linear",
            city: "Santos",
            state: "SP",
            shortDescription: "Passeio ao ar livre próximo ao hotel para famílias e descanso.",
            imageUrl: "https://example.com/experiencia.webp",
            imageAlt: "Parque próximo ao hotel",
            categories: [],
            preferences: ["crianças"],
            distanceText: "10 min de carro",
            isActive: true,
          },
        ]),
      })
    );

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toContain("categoria");
    }
  });
});
