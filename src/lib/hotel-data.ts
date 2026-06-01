import { unstable_cache } from "next/cache";

import {
  hotels as fallbackHotels,
  getHotelBySlug,
  type Hotel as FallbackHotel,
} from "@/data/hotels";
import { prisma } from "@/lib/prisma";

export type PublishedHotelCard = {
  slug: string;
  name: string;
  shortDescription?: string;
  city: string;
  state: string;
  coverImageUrl: string;
};

type HotelImageRow = {
  id: string;
  url: string;
  alt: string;
  position: number;
};

type HotelAmenityRow = {
  id: string;
  label: string;
  position: number;
};

type HotelPolicyRow = {
  id: string;
  title: string;
  description: string;
  position: number;
};

type HotelRoomRow = {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  capacityAdults: number;
  capacityChildren: number;
  capacity: number;
  beds: string;
  sizeM2: number | null;
  size: string;
  amenities: string[];
  priceFrom: { toString(): string };
  lowestActiveRateCents: number | null;
  isAvailable: boolean;
  isActive: boolean;
  publicAvailabilityStatus: "available" | "unavailable" | "unknown";
  availability: Array<{
    date: string;
    availableUnits: number;
    closed: boolean;
  }>;
  rates: Array<{
    id: string;
    name: string;
    description: string;
    priceCents: number;
    currency: string;
    startDate: string;
    endDate: string;
    minNights: number;
    maxGuests: number;
    refundable: boolean;
    breakfastIncluded: boolean;
  }>;
};

export type HotelNearbyPlace = {
  name: string;
  type:
    | "airport"
    | "beach"
    | "shopping"
    | "museum"
    | "historic_center"
    | "restaurant"
    | "convention_center"
    | "park";
  distanceText: string;
};

export type HotelPageData = {
  id: string;
  slug: string;
  name: string;
  shortDescription: string;
  fullDescription: string;
  city: string;
  state: string;
  address: string;
  phone: string;
  email: string;
  whatsapp: string;
  coverImageUrl: string;
  checkInTime: string;
  checkOutTime: string;
  latitude: { toString(): string } | null;
  longitude: { toString(): string } | null;
  images: HotelImageRow[];
  rooms: HotelRoomRow[];
  amenities: HotelAmenityRow[];
  policies: HotelPolicyRow[];
  nearbyPlaces: HotelNearbyPlace[];
};

const nearbyPlacesBySlug: Record<string, HotelNearbyPlace[]> = {
  "pousada-charle-brown": [
    { name: "Praia central de Garopaba", type: "beach", distanceText: "8 min de carro" },
    { name: "Lagoa costeira da região", type: "park", distanceText: "12 min de carro" },
    { name: "Centro comercial local", type: "shopping", distanceText: "6 min de carro" },
    { name: "Polo gastronômico litorâneo", type: "restaurant", distanceText: "10 min de carro" },
  ],
  "lph-serra-imperial": [
    { name: "Centro histórico serrano", type: "historic_center", distanceText: "9 min de carro" },
    { name: "Museu regional da cidade", type: "museum", distanceText: "11 min de carro" },
    { name: "Parque de trilhas e mirantes", type: "park", distanceText: "14 min de carro" },
    { name: "Boulevard gastronômico", type: "restaurant", distanceText: "7 min de carro" },
  ],
  "lph-jardins": [
    { name: "Aeroporto da capital", type: "airport", distanceText: "22 min de carro" },
    { name: "Centro de compras premium", type: "shopping", distanceText: "5 min de carro" },
    { name: "Museu de arte urbana", type: "museum", distanceText: "9 min de carro" },
    { name: "Corredor gastronômico dos Jardins", type: "restaurant", distanceText: "4 min a pé" },
  ],
  "lph-lago-sul": [
    { name: "Aeroporto internacional da cidade", type: "airport", distanceText: "18 min de carro" },
    {
      name: "Centro de convenções da região",
      type: "convention_center",
      distanceText: "16 min de carro",
    },
    { name: "Parque urbano à beira do lago", type: "park", distanceText: "10 min de carro" },
    { name: "Polo gastronômico do Lago Sul", type: "restaurant", distanceText: "8 min de carro" },
  ],
  "lph-boa-viagem": [
    { name: "Praia de Boa Viagem", type: "beach", distanceText: "3 min a pé" },
    { name: "Aeroporto da cidade", type: "airport", distanceText: "14 min de carro" },
    { name: "Shopping da zona sul", type: "shopping", distanceText: "9 min de carro" },
    { name: "Centro gastronômico da orla", type: "restaurant", distanceText: "6 min de carro" },
  ],
  "lph-pelourinho": [
    { name: "Centro histórico do entorno", type: "historic_center", distanceText: "4 min a pé" },
    { name: "Museu cultural da região", type: "museum", distanceText: "7 min a pé" },
    { name: "Polo de restaurantes coloniais", type: "restaurant", distanceText: "5 min a pé" },
    { name: "Praça com programação artística", type: "park", distanceText: "6 min a pé" },
  ],
  "lph-gramado-village": [
    { name: "Centro charmoso da cidade", type: "historic_center", distanceText: "8 min de carro" },
    { name: "Parque de lazer da serra", type: "park", distanceText: "12 min de carro" },
    { name: "Boulevard de chocolates e cafés", type: "shopping", distanceText: "9 min de carro" },
    {
      name: "Restaurantes da avenida principal",
      type: "restaurant",
      distanceText: "7 min de carro",
    },
  ],
  "lph-beira-mar": [
    { name: "Orla da Beira-Mar", type: "beach", distanceText: "4 min a pé" },
    { name: "Parque urbano da baía", type: "park", distanceText: "10 min de carro" },
    { name: "Centro comercial da região norte", type: "shopping", distanceText: "8 min de carro" },
    { name: "Corredor gastronômico litorâneo", type: "restaurant", distanceText: "6 min de carro" },
  ],
};

function getNearbyPlaces(slug: string): HotelNearbyPlace[] {
  return canUseDevelopmentFallback ? (nearbyPlacesBySlug[slug] ?? []) : [];
}

const databaseUrl = process.env.DATABASE_URL?.trim();
const canUseDevelopmentFallback =
  process.env.NODE_ENV === "development" && process.env.ALLOW_LOCAL_HOTEL_DATA_FALLBACK === "true";
const isNextProductionBuild = process.env.NEXT_PHASE === "phase-production-build";

let warnedUnavailableDb = false;
let schemaSupportPromise: Promise<boolean> | null = null;

function warnDatabaseFallback(error: unknown) {
  if (warnedUnavailableDb) {
    return;
  }

  warnedUnavailableDb = true;

  const message = error instanceof Error ? error.message : "Unknown database error";
  console.warn(`[hotel-data] Falling back to local hotel data: ${message}`);
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

function getFallbackPublishedHotels() {
  return canUseDevelopmentFallback ? fallbackHotels.map(mapFallbackCard) : [];
}

function getFallbackHotelSlugs() {
  return canUseDevelopmentFallback ? fallbackHotels.map((hotel) => hotel.slug) : [];
}

function getFallbackHotelPageData(slug: string) {
  if (!canUseDevelopmentFallback) {
    return null;
  }

  const hotel = getHotelBySlug(slug);
  return hotel ? mapFallbackHotel(hotel) : null;
}

async function hasCompatibleHotelSchema() {
  if (shouldSkipDatabaseDuringBuild()) {
    return false;
  }

  if (!hasDatabaseConfig()) {
    if (!canUseDevelopmentFallback) {
      throw new Error("DATABASE_URL não configurada.");
    }

    return false;
  }

  if (!schemaSupportPromise) {
    schemaSupportPromise = prisma.$queryRaw<Array<{ column_name: string }>>`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'Hotel'
      `
      .then((rows) => {
        const columns = new Set(rows.map((row) => row.column_name));

        return ["slug", "name", "city", "state", "coverImageUrl", "isPublished", "phone"].every(
          (column) => columns.has(column)
        );
      })
      .catch((error) => {
        return handleDatabaseFallback(error, false);
      });
  }

  return schemaSupportPromise;
}

function mapFallbackCard(hotel: FallbackHotel): PublishedHotelCard {
  return {
    slug: hotel.slug,
    name: hotel.name,
    shortDescription: hotel.shortDescription,
    city: hotel.city,
    state: hotel.state,
    coverImageUrl: hotel.image,
  };
}

function mapFallbackHotel(hotel: FallbackHotel): HotelPageData {
  return {
    id: `fallback-${hotel.slug}`,
    slug: hotel.slug,
    name: hotel.name,
    shortDescription: hotel.shortDescription,
    fullDescription: hotel.fullDescription,
    city: hotel.city,
    state: hotel.state,
    address: hotel.address,
    phone: hotel.contacts.phone,
    email: hotel.contacts.email,
    whatsapp: hotel.contacts.whatsapp,
    coverImageUrl: hotel.image,
    checkInTime: hotel.checkIn,
    checkOutTime: hotel.checkOut,
    latitude: null,
    longitude: null,
    images: hotel.gallery.map((url, index) => ({
      id: `fallback-image-${hotel.slug}-${index}`,
      url,
      alt: hotel.alt,
      position: index,
    })),
    rooms: [],
    amenities: hotel.amenities.map((label, index) => ({
      id: `fallback-amenity-${hotel.slug}-${index}`,
      label,
      position: index,
    })),
    policies: hotel.policies.map((policy, index) => ({
      id: `fallback-policy-${hotel.slug}-${index}`,
      title: policy.title,
      description: policy.description,
      position: index,
    })),
    nearbyPlaces: getNearbyPlaces(hotel.slug),
  };
}

function getPublicAvailabilityStatus(
  availability: Array<{
    closed: boolean;
    availableUnits: number;
  }>
): HotelRoomRow["publicAvailabilityStatus"] {
  if (availability.length === 0) {
    return "unknown";
  }

  return availability.some((entry) => !entry.closed && entry.availableUnits > 0)
    ? "available"
    : "unavailable";
}

async function fetchPublishedHotels(): Promise<PublishedHotelCard[]> {
  if (!(await hasCompatibleHotelSchema())) {
    return getFallbackPublishedHotels();
  }

  try {
    return await prisma.hotel.findMany({
      where: {
        isPublished: true,
      },
      select: {
        slug: true,
        name: true,
        shortDescription: true,
        city: true,
        state: true,
        coverImageUrl: true,
      },
      orderBy: [{ city: "asc" }, { name: "asc" }],
    });
  } catch (error) {
    return handleDatabaseFallback(error, getFallbackPublishedHotels());
  }
}

const getCachedPublishedHotels = unstable_cache(fetchPublishedHotels, ["published-hotels"], {
  revalidate: 300,
  tags: ["published-hotels"],
});

export async function getPublishedHotels(): Promise<PublishedHotelCard[]> {
  return getCachedPublishedHotels();
}

export async function getHotelSlugs(): Promise<string[]> {
  if (!(await hasCompatibleHotelSchema())) {
    return getFallbackHotelSlugs();
  }

  try {
    const hotels = await prisma.hotel.findMany({
      where: {
        isPublished: true,
      },
      select: {
        slug: true,
      },
    });

    return hotels.map((hotel) => hotel.slug);
  } catch (error) {
    return handleDatabaseFallback(error, getFallbackHotelSlugs());
  }
}

export async function getHotelPageData(slug: string): Promise<HotelPageData | null> {
  if (!(await hasCompatibleHotelSchema())) {
    return getFallbackHotelPageData(slug);
  }

  try {
    const now = new Date();
    const hotel = await prisma.hotel.findFirst({
      where: {
        slug,
        isPublished: true,
      },
      include: {
        images: {
          orderBy: {
            position: "asc",
          },
        },
        rooms: {
          where: {
            isActive: true,
          },
          orderBy: {
            createdAt: "asc",
          },
          include: {
            rates: {
              where: {
                isActive: true,
                endDate: {
                  gte: now,
                },
              },
              orderBy: {
                startDate: "asc",
              },
              select: {
                id: true,
                name: true,
                description: true,
                priceCents: true,
                currency: true,
                startDate: true,
                endDate: true,
                minNights: true,
                maxGuests: true,
                refundable: true,
                breakfastIncluded: true,
              },
            },
            availability: {
              where: {
                date: {
                  gte: now,
                },
              },
              orderBy: {
                date: "asc",
              },
              take: 30,
              select: {
                date: true,
                closed: true,
                availableUnits: true,
              },
            },
          },
        },
        amenities: {
          orderBy: {
            position: "asc",
          },
        },
        policies: {
          orderBy: {
            position: "asc",
          },
        },
      },
    });

    return hotel
      ? {
          ...hotel,
          rooms: hotel.rooms.map((room) => ({
            id: room.id,
            name: room.name,
            description: room.description,
            imageUrl: room.imageUrl,
            capacityAdults: room.capacityAdults,
            capacityChildren: room.capacityChildren,
            capacity: room.capacity,
            beds: room.beds,
            sizeM2: room.sizeM2,
            size: room.size,
            amenities: room.amenities,
            priceFrom: room.priceFrom,
            lowestActiveRateCents:
              room.rates.length > 0
                ? room.rates.reduce(
                    (lowest, rate) => (rate.priceCents < lowest ? rate.priceCents : lowest),
                    room.rates[0].priceCents
                  )
                : null,
            isAvailable: room.isAvailable,
            isActive: room.isActive,
            publicAvailabilityStatus: getPublicAvailabilityStatus(room.availability),
            availability: room.availability.map((entry) => ({
              date: entry.date.toISOString().slice(0, 10),
              availableUnits: entry.availableUnits,
              closed: entry.closed,
            })),
            rates: room.rates.map((rate) => ({
              id: rate.id,
              name: rate.name,
              description: rate.description,
              priceCents: rate.priceCents,
              currency: rate.currency,
              startDate: rate.startDate.toISOString().slice(0, 10),
              endDate: rate.endDate.toISOString().slice(0, 10),
              minNights: rate.minNights,
              maxGuests: rate.maxGuests,
              refundable: rate.refundable,
              breakfastIncluded: rate.breakfastIncluded,
            })),
          })),
          nearbyPlaces: getNearbyPlaces(hotel.slug),
        }
      : null;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const canRetryWithoutRooms =
      message.includes("HotelRoom") ||
      message.includes("RoomRate") ||
      message.includes("public.HotelRoom") ||
      message.includes("public.RoomRate");

    if (!canRetryWithoutRooms) {
      return handleDatabaseFallback(error, getFallbackHotelPageData(slug));
    }

    console.warn(`[hotel-data] Retrying hotel detail without rooms for slug "${slug}": ${message}`);

    try {
      const hotel = await prisma.hotel.findFirst({
        where: {
          slug,
          isPublished: true,
        },
        include: {
          images: {
            orderBy: {
              position: "asc",
            },
          },
          amenities: {
            orderBy: {
              position: "asc",
            },
          },
          policies: {
            orderBy: {
              position: "asc",
            },
          },
        },
      });

      return hotel
        ? {
            ...hotel,
            rooms: [],
            nearbyPlaces: getNearbyPlaces(hotel.slug),
          }
        : getFallbackHotelPageData(slug);
    } catch (retryError) {
      return handleDatabaseFallback(retryError, getFallbackHotelPageData(slug));
    }
  }
}
