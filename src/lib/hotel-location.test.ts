import { describe, expect, it } from "vitest";

import {
  getCityStateCoordinates,
  normalizeCoordinateValue,
  resolveHotelMapLocation,
} from "@/lib/hotel-location";

describe("hotel location resolution", () => {
  it("mantem coordenadas validas existentes", () => {
    expect(
      resolveHotelMapLocation({
        city: "Santos",
        state: "SP",
        latitude: "-23.9882000",
        longitude: "-46.3032000",
      })
    ).toEqual({
      latitude: -23.9882,
      longitude: -46.3032,
      source: "coordinates",
    });
  });

  it("usa catalogo interno por cidade e estado quando faltam coordenadas", () => {
    expect(
      resolveHotelMapLocation({
        city: "Florianopolis",
        state: "SC",
      })
    ).toEqual({
      latitude: -27.5949,
      longitude: -48.5482,
      source: "city_state",
    });
  });

  it("retorna nulo para cidade sem mapeamento interno", () => {
    expect(
      resolveHotelMapLocation({
        city: "Cidade Inexistente",
        state: "SP",
      })
    ).toBeNull();
  });

  it("normaliza coordenadas vazias como nulo", () => {
    expect(normalizeCoordinateValue("")).toBeNull();
    expect(normalizeCoordinateValue(null)).toBeNull();
    expect(getCityStateCoordinates("São Paulo", "sp")).toEqual({
      latitude: -23.5654,
      longitude: -46.6629,
    });
  });
});
