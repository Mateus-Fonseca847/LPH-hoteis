import { describe, expect, it } from "vitest";

import { mapHotelsForPublicMap } from "./hotel-map";

describe("mapHotelsForPublicMap", () => {
  it("descarta hoteis sem localizacao publica valida", () => {
    expect(
      mapHotelsForPublicMap([
        {
          id: "hotel-1",
          slug: "hotel-1",
          name: "Hotel 1",
          shortDescription: "Desc",
          city: "Cidade Sem Mapa",
          state: "SP",
          address: "Rua 1",
          coverImageUrl: "/hotel-1.webp",
          latitude: null,
          longitude: null,
        },
      ])
    ).toEqual([]);
  });

  it("mantem hotel quando latitude e longitude validas ja existem", () => {
    expect(
      mapHotelsForPublicMap([
        {
          id: "hotel-1",
          slug: "hotel-1",
          name: "Hotel 1",
          shortDescription: "Desc",
          city: "Cidade A",
          state: "SP",
          address: "Rua 1",
          coverImageUrl: "/hotel-1.webp",
          latitude: { toString: () => "-23.5505" },
          longitude: { toString: () => "-46.6333" },
        },
      ])
    ).toEqual([
      expect.objectContaining({
        slug: "hotel-1",
        latitude: -23.5505,
        longitude: -46.6333,
      }),
    ]);
  });

  it("mantem hotel quando cidade e estado resolvem a posicao no mapa", () => {
    expect(
      mapHotelsForPublicMap([
        {
          id: "hotel-2",
          slug: "hotel-2",
          name: "Hotel 2",
          shortDescription: "Desc",
          city: "Sao Paulo",
          state: "SP",
          address: "Rua 2",
          coverImageUrl: "/hotel-2.webp",
          latitude: null,
          longitude: null,
        },
      ])
    ).toEqual([
      expect.objectContaining({
        slug: "hotel-2",
        city: "Sao Paulo",
        state: "SP",
        latitude: -23.5654,
        longitude: -46.6629,
      }),
    ]);
  });
});
