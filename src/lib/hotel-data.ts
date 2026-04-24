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
  amenities: HotelAmenityRow[];
  policies: HotelPolicyRow[];
};

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
    return await prisma.hotel.findFirst({
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
  } catch (error) {
    warnDatabaseFallback(error);
    const hotel = getHotelBySlug(slug);
    return hotel ? mapFallbackHotel(hotel) : null;
  }
}
