import { hotels as fallbackHotels, getHotelBySlug, type Hotel as FallbackHotel } from "@/data/hotels";
import { prisma } from "@/lib/prisma";

export type PublishedHotelCard = {
  slug: string;
  name: string;
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
  capacity: number;
  beds: string;
  size: string;
  priceFrom: { toString(): string };
  isAvailable: boolean;
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
    { name: "Centro de convenções da região", type: "convention_center", distanceText: "16 min de carro" },
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
    { name: "Restaurantes da avenida principal", type: "restaurant", distanceText: "7 min de carro" },
  ],
  "lph-beira-mar": [
    { name: "Orla da Beira-Mar", type: "beach", distanceText: "4 min a pé" },
    { name: "Parque urbano da baía", type: "park", distanceText: "10 min de carro" },
    { name: "Centro comercial da região norte", type: "shopping", distanceText: "8 min de carro" },
    { name: "Corredor gastronômico litorâneo", type: "restaurant", distanceText: "6 min de carro" },
  ],
};

function getNearbyPlaces(slug: string): HotelNearbyPlace[] {
  return nearbyPlacesBySlug[slug] ?? [];
}

const databaseUrl = process.env.DATABASE_URL?.trim();

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

function hasDatabaseConfig() {
  return Boolean(databaseUrl);
}

async function hasCompatibleHotelSchema() {
  if (!hasDatabaseConfig()) {
    return false;
  }

  if (!schemaSupportPromise) {
    schemaSupportPromise = prisma
      .$queryRaw<Array<{ column_name: string }>>`
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
        warnDatabaseFallback(error);
        return false;
      });
  }

  return schemaSupportPromise;
}

function mapFallbackCard(hotel: FallbackHotel): PublishedHotelCard {
  return {
    slug: hotel.slug,
    name: hotel.name,
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

export async function getPublishedHotels(): Promise<PublishedHotelCard[]> {
  if (!(await hasCompatibleHotelSchema())) {
    return fallbackHotels.map(mapFallbackCard);
  }

  try {
    return await prisma.hotel.findMany({
      where: {
        isPublished: true,
      },
      select: {
        slug: true,
        name: true,
        city: true,
        state: true,
        coverImageUrl: true,
      },
      orderBy: [{ city: "asc" }, { name: "asc" }],
    });
  } catch (error) {
    warnDatabaseFallback(error);
    return fallbackHotels.map(mapFallbackCard);
  }
}

export async function getHotelSlugs(): Promise<string[]> {
  if (!(await hasCompatibleHotelSchema())) {
    return fallbackHotels.map((hotel) => hotel.slug);
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
    warnDatabaseFallback(error);
    return fallbackHotels.map((hotel) => hotel.slug);
  }
}

export async function getHotelPageData(slug: string): Promise<HotelPageData | null> {
  if (!(await hasCompatibleHotelSchema())) {
    const hotel = getHotelBySlug(slug);
    return hotel ? mapFallbackHotel(hotel) : null;
  }

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
        rooms: {
          orderBy: {
            createdAt: "asc",
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
          nearbyPlaces: getNearbyPlaces(hotel.slug),
        }
      : null;
  } catch (error) {
    warnDatabaseFallback(error);
    const hotel = getHotelBySlug(slug);
    return hotel ? mapFallbackHotel(hotel) : null;
  }
}
