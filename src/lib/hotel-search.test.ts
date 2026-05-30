import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getHotelSearchSuggestions,
  normalizeHotelSearchQuery,
  searchPublishedHotels,
} from "@/lib/hotel-search";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    hotel: {
      findMany: vi.fn(),
    },
  },
}));

const findHotels = vi.mocked(prisma.hotel.findMany);

const hotels = [
  {
    slug: "lph-recife",
    name: "LPH Recife",
    city: "Recife",
    state: "PE",
    address: "Boa Viagem",
    coverImageUrl: "/recife.webp",
    shortDescription: "Hotel na praia",
  },
  {
    slug: "lph-boa-viagem",
    name: "LPH Boa Viagem",
    city: "Recife",
    state: "PE",
    address: "Orla",
    coverImageUrl: "/boa.webp",
    shortDescription: "Perto da praia",
  },
];

describe("hotel search business rules", () => {
  beforeEach(() => {
    findHotels.mockReset();
  });

  it("normaliza espacos e limita tamanho da busca", () => {
    expect(normalizeHotelSearchQuery("  Recife   PE  ")).toBe("Recife PE");
    expect(normalizeHotelSearchQuery("x".repeat(120))).toHaveLength(80);
  });

  it("busca apenas hoteis publicados", async () => {
    findHotels.mockResolvedValue(hotels as never);

    await expect(searchPublishedHotels("Recife")).resolves.toEqual(hotels);

    expect(findHotels).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isPublished: true,
        }),
      })
    );
  });

  it("ignora buscas muito curtas antes de consultar o banco", async () => {
    await expect(searchPublishedHotels(" r ")).resolves.toEqual([]);
    expect(findHotels).not.toHaveBeenCalled();
  });

  it("gera sugestoes de hotel e destino sem duplicar cidade/estado", async () => {
    findHotels.mockResolvedValue(hotels as never);

    const suggestions = await getHotelSearchSuggestions("Recife");

    expect(suggestions.filter((suggestion) => suggestion.type === "hotel")).toHaveLength(2);
    expect(
      suggestions.filter(
        (suggestion) => suggestion.type === "destination" && suggestion.label === "Recife, PE"
      )
    ).toHaveLength(1);
  });

  it("propaga erro do banco fora do fallback local", async () => {
    findHotels.mockRejectedValue(new Error("db down"));

    await expect(searchPublishedHotels("Recife")).rejects.toThrow("db down");
  });
});
