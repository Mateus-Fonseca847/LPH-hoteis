import { describe, expect, it, vi } from "vitest";

import { dedupePublicHotels } from "./public-hotel-dedupe";

describe("dedupePublicHotels", () => {
  it("preserva a primeira ocorrencia ao duplicar por id", () => {
    const hotels = dedupePublicHotels(
      [
        { id: "hotel-1", slug: "casa-mare", name: "Pousada Casa Mare" },
        { id: "hotel-1", slug: "casa-mare-copia", name: "Pousada Casa Mare copia" },
      ],
      "home/hotels"
    );

    expect(hotels).toEqual([{ id: "hotel-1", slug: "casa-mare", name: "Pousada Casa Mare" }]);
  });

  it("preserva a primeira ocorrencia ao duplicar por slug", () => {
    const hotels = dedupePublicHotels(
      [
        { id: "hotel-1", slug: "pousada-casa-mare", name: "Pousada Casa Mare" },
        { id: "hotel-2", slug: "pousada-casa-mare", name: "Pousada Casa Mare duplicada" },
      ],
      "home/hotels"
    );

    expect(hotels).toEqual([
      { id: "hotel-1", slug: "pousada-casa-mare", name: "Pousada Casa Mare" },
    ]);
  });

  it("mantem hoteis diferentes com nomes parecidos", () => {
    const hotels = dedupePublicHotels([
      { id: "hotel-1", slug: "casa-mare-rio", name: "Pousada Casa Mare", city: "Rio", state: "RJ" },
      {
        id: "hotel-2",
        slug: "casa-mare-buzios",
        name: "Pousada Casa Mare",
        city: "Buzios",
        state: "RJ",
      },
    ]);

    expect(hotels).toHaveLength(2);
  });

  it("registra log seguro quando encontra duplicatas", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    dedupePublicHotels([
      { slug: "pousada-casa-mare", name: "Pousada Casa Mare" },
      { slug: "pousada-casa-mare", name: "Pousada Casa Mare" },
    ]);

    expect(warn).toHaveBeenCalledWith(
      "[home/hotels] Deduplicated public hotels.",
      expect.objectContaining({
        before: 2,
        after: 1,
        duplicateKeys: ["slug:pousada-casa-mare"],
      })
    );

    warn.mockRestore();
  });
});
