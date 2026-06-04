import { unstable_cache } from "next/cache";

import { hotels as fallbackHotels } from "@/data/hotels";
import { resolveHotelMapLocation } from "@/lib/hotel-location";
import { prisma } from "@/lib/prisma";
import { PUBLIC_HOTEL_WHERE } from "@/lib/public-hotel";

export type PublicMapHotel = {
  id: string;
  slug: string;
  name: string;
  shortDescription: string;
  city: string;
  state: string;
  address: string;
  coverImageUrl: string;
  latitude: number;
  longitude: number;
};

type PublicMapHotelRow = {
  id: string;
  slug: string;
  name: string;
  shortDescription: string;
  city: string;
  state: string;
  address: string;
  coverImageUrl: string;
  latitude: { toString(): string } | null;
  longitude: { toString(): string } | null;
};

const databaseUrl = process.env.DATABASE_URL?.trim();
const canUseDevelopmentFallback =
  process.env.NODE_ENV === "development" && process.env.ALLOW_LOCAL_HOTEL_DATA_FALLBACK === "true";
const isNextProductionBuild = process.env.NEXT_PHASE === "phase-production-build";

let warnedUnavailableDb = false;

function warnDatabaseFallback(error: unknown) {
  if (warnedUnavailableDb) {
    return;
  }

  warnedUnavailableDb = true;

  const message = error instanceof Error ? error.message : "Unknown database error";
  console.warn(`[hotel-map] Falling back to local map data: ${message}`);
}

function throwProductionDatabaseError(error: unknown): never {
  if (error instanceof Error) {
    throw error;
  }

  throw new Error("Database unavailable.");
}

function handleDatabaseFallback<T>(error: unknown, fallback: T): T {
  if (!canUseDevelopmentFallback) {
    throwProductionDatabaseError(error);
  }

  warnDatabaseFallback(error);
  return fallback;
}

function hasDatabaseConfig() {
  return Boolean(databaseUrl);
}

function shouldSkipDatabaseDuringBuild() {
  return isNextProductionBuild && process.env.ALLOW_DATABASE_DURING_BUILD !== "true";
}

export function mapHotelsForPublicMap(hotels: PublicMapHotelRow[]): PublicMapHotel[] {
  return hotels.flatMap((hotel) => {
    const resolvedLocation = resolveHotelMapLocation({
      city: hotel.city,
      state: hotel.state,
      latitude: hotel.latitude,
      longitude: hotel.longitude,
    });

    if (!resolvedLocation) {
      return [];
    }

    return [
      {
        id: hotel.id,
        slug: hotel.slug,
        name: hotel.name,
        shortDescription: hotel.shortDescription,
        city: hotel.city,
        state: hotel.state,
        address: hotel.address,
        coverImageUrl: hotel.coverImageUrl,
        latitude: resolvedLocation.latitude,
        longitude: resolvedLocation.longitude,
      },
    ];
  });
}

function getFallbackPublishedMapHotels(): PublicMapHotel[] {
  if (!canUseDevelopmentFallback) {
    return [];
  }

  return fallbackHotels.flatMap((hotel) => {
    const resolvedLocation = resolveHotelMapLocation({
      city: hotel.city,
      state: hotel.state,
    });

    if (!resolvedLocation) {
      return [];
    }

    return [
      {
        id: `fallback-${hotel.slug}`,
        slug: hotel.slug,
        name: hotel.name,
        shortDescription: hotel.shortDescription,
        city: hotel.city,
        state: hotel.state,
        address: hotel.address,
        coverImageUrl: hotel.image,
        latitude: resolvedLocation.latitude,
        longitude: resolvedLocation.longitude,
      },
    ];
  });
}

async function fetchPublishedMapHotels(): Promise<PublicMapHotel[]> {
  if (shouldSkipDatabaseDuringBuild()) {
    return getFallbackPublishedMapHotels();
  }

  if (!hasDatabaseConfig()) {
    if (!canUseDevelopmentFallback) {
      throw new Error("DATABASE_URL não configurada.");
    }

    return getFallbackPublishedMapHotels();
  }

  try {
    const hotels = await prisma.hotel.findMany({
      where: PUBLIC_HOTEL_WHERE,
      select: {
        id: true,
        slug: true,
        name: true,
        shortDescription: true,
        city: true,
        state: true,
        address: true,
        coverImageUrl: true,
        latitude: true,
        longitude: true,
      },
      orderBy: [{ state: "asc" }, { city: "asc" }, { name: "asc" }],
    });

    return mapHotelsForPublicMap(hotels);
  } catch (error) {
    return handleDatabaseFallback(error, getFallbackPublishedMapHotels());
  }
}

export const getPublishedMapHotels = unstable_cache(
  fetchPublishedMapHotels,
  ["published-map-hotels"],
  {
    revalidate: 300,
    tags: ["published-hotels"],
  }
);
