"use client";

export const HOTEL_FAVORITES_STORAGE_KEY = "lph-hotel-favorites";
const HOTEL_FAVORITES_UPDATED_EVENT = "lph:hotel-favorites-updated";

export type FavoriteHotel = {
  slug: string;
  name: string;
  city: string;
  state: string;
  coverImageUrl?: string;
};

function isBrowser() {
  return typeof window !== "undefined";
}

function normalizeFavoriteHotel(hotel: FavoriteHotel): FavoriteHotel {
  return {
    slug: hotel.slug.trim(),
    name: hotel.name.trim(),
    city: hotel.city.trim(),
    state: hotel.state.trim().toUpperCase(),
    coverImageUrl: hotel.coverImageUrl?.trim() || undefined,
  };
}

function isFavoriteHotel(value: unknown): value is FavoriteHotel {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.slug === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.city === "string" &&
    typeof candidate.state === "string" &&
    (typeof candidate.coverImageUrl === "string" || typeof candidate.coverImageUrl === "undefined")
  );
}

function dispatchFavoritesUpdated() {
  if (!isBrowser()) {
    return;
  }

  window.dispatchEvent(new CustomEvent(HOTEL_FAVORITES_UPDATED_EVENT));
}

export function listFavoriteHotels() {
  if (!isBrowser()) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(HOTEL_FAVORITES_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];

    if (!Array.isArray(parsed)) {
      return [];
    }

    const uniqueHotels = new Map<string, FavoriteHotel>();

    parsed.forEach((item) => {
      if (!isFavoriteHotel(item)) {
        return;
      }

      const hotel = normalizeFavoriteHotel(item);

      if (!hotel.slug) {
        return;
      }

      uniqueHotels.set(hotel.slug, hotel);
    });

    return [...uniqueHotels.values()];
  } catch {
    return [];
  }
}

export function isHotelFavorited(slug: string) {
  return listFavoriteHotels().some((hotel) => hotel.slug === slug.trim());
}

export function addFavoriteHotel(hotel: FavoriteHotel) {
  if (!isBrowser()) {
    return [];
  }

  const nextHotel = normalizeFavoriteHotel(hotel);
  const favorites = listFavoriteHotels().filter((item) => item.slug !== nextHotel.slug);
  const nextFavorites = [...favorites, nextHotel];

  window.localStorage.setItem(HOTEL_FAVORITES_STORAGE_KEY, JSON.stringify(nextFavorites));
  dispatchFavoritesUpdated();

  return nextFavorites;
}

export function removeFavoriteHotel(slug: string) {
  if (!isBrowser()) {
    return [];
  }

  const nextFavorites = listFavoriteHotels().filter((hotel) => hotel.slug !== slug.trim());
  window.localStorage.setItem(HOTEL_FAVORITES_STORAGE_KEY, JSON.stringify(nextFavorites));
  dispatchFavoritesUpdated();

  return nextFavorites;
}

export function toggleFavoriteHotel(hotel: FavoriteHotel) {
  if (isHotelFavorited(hotel.slug)) {
    return {
      favorites: removeFavoriteHotel(hotel.slug),
      isFavorited: false,
    };
  }

  return {
    favorites: addFavoriteHotel(hotel),
    isFavorited: true,
  };
}

export function subscribeToFavoriteHotels(callback: () => void) {
  if (!isBrowser()) {
    return () => undefined;
  }

  const handleStorage = (event: StorageEvent) => {
    if (!event.key || event.key === HOTEL_FAVORITES_STORAGE_KEY) {
      callback();
    }
  };

  window.addEventListener("storage", handleStorage);
  window.addEventListener(HOTEL_FAVORITES_UPDATED_EVENT, callback);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(HOTEL_FAVORITES_UPDATED_EVENT, callback);
  };
}
