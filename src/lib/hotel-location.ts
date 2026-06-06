import { normalizeText } from "@/lib/normalize-text";

export type ResolvedHotelMapLocation = {
  latitude: number;
  longitude: number;
  source: "coordinates" | "city_state";
};

const BRAZIL_BOUNDS = {
  minLatitude: -34,
  maxLatitude: 6,
  minLongitude: -74,
  maxLongitude: -34,
};

const cityStateCoordinateCatalog = new Map<
  string,
  {
    latitude: number;
    longitude: number;
  }
>([
  ["santos::SP", { latitude: -23.9882, longitude: -46.3032 }],
  ["gramado::RS", { latitude: -29.3793, longitude: -50.8735 }],
  ["sao paulo::SP", { latitude: -23.5654, longitude: -46.6629 }],
  ["recife::PE", { latitude: -8.1268, longitude: -34.9007 }],
  ["brasilia::DF", { latitude: -15.831, longitude: -47.8728 }],
  ["garopaba::SC", { latitude: -28.0278, longitude: -48.6197 }],
  ["petropolis::RJ", { latitude: -22.5092, longitude: -43.1779 }],
  ["salvador::BA", { latitude: -12.9718, longitude: -38.5011 }],
  ["florianopolis::SC", { latitude: -27.5949, longitude: -48.5482 }],
]);

function buildCityStateKey(city: string, state: string) {
  return `${normalizeText(city.trim())}::${state.trim().toUpperCase()}`;
}

export function normalizeCoordinateValue(value: unknown) {
  if (
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim().length === 0)
  ) {
    return null;
  }

  const normalized = Number(
    typeof value === "object" && value !== null && "toString" in value ? value.toString() : value
  );

  return Number.isFinite(normalized) ? normalized : null;
}

export function isInsideBrazilBounds(latitude: number, longitude: number) {
  return (
    latitude >= BRAZIL_BOUNDS.minLatitude &&
    latitude <= BRAZIL_BOUNDS.maxLatitude &&
    longitude >= BRAZIL_BOUNDS.minLongitude &&
    longitude <= BRAZIL_BOUNDS.maxLongitude
  );
}

export function getCityStateCoordinates(city: string, state: string) {
  return cityStateCoordinateCatalog.get(buildCityStateKey(city, state)) ?? null;
}

export function resolveHotelMapLocation(input: {
  city: string;
  state: string;
  latitude?: unknown;
  longitude?: unknown;
}): ResolvedHotelMapLocation | null {
  const latitude = normalizeCoordinateValue(input.latitude);
  const longitude = normalizeCoordinateValue(input.longitude);

  if (latitude !== null && longitude !== null && isInsideBrazilBounds(latitude, longitude)) {
    return {
      latitude,
      longitude,
      source: "coordinates",
    };
  }

  const mapped = getCityStateCoordinates(input.city, input.state);

  if (!mapped || !isInsideBrazilBounds(mapped.latitude, mapped.longitude)) {
    return null;
  }

  return {
    latitude: mapped.latitude,
    longitude: mapped.longitude,
    source: "city_state",
  };
}
