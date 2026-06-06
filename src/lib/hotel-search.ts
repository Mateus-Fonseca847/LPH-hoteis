import { hotels as fallbackHotels } from "@/data/hotels";
import { normalizeText } from "@/lib/normalize-text";
import { prisma } from "@/lib/prisma";

const MAX_QUERY_LENGTH = 80;
const MAX_SUGGESTIONS = 8;
const MAX_RESULTS = 24;

export type HotelSearchSuggestion = {
  id: string;
  type: "hotel" | "destination";
  label: string;
  description: string;
  href: string;
};

export type HotelSearchResult = {
  slug: string;
  name: string;
  city: string;
  state: string;
  address: string;
  coverImageUrl: string;
  shortDescription: string;
};

const canUseDevelopmentFallback =
  process.env.NODE_ENV === "development" && process.env.ALLOW_LOCAL_HOTEL_DATA_FALLBACK === "true";

export function normalizeHotelSearchQuery(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, MAX_QUERY_LENGTH);
}

function getSearchHref(query: string) {
  return `/buscar?destino=${encodeURIComponent(query)}`;
}

function matchesHotelQuery(
  hotel: Pick<HotelSearchResult, "name" | "city" | "state" | "address" | "shortDescription"> & {
    fullDescription?: string;
  },
  query: string
) {
  const normalizedQuery = normalizeText(query);

  return [
    hotel.name,
    hotel.city,
    hotel.state,
    hotel.address,
    hotel.shortDescription,
    hotel.fullDescription,
  ]
    .filter(Boolean)
    .some((value) => normalizeText(String(value)).includes(normalizedQuery));
}

function mapFallbackResult(hotel: (typeof fallbackHotels)[number]): HotelSearchResult {
  return {
    slug: hotel.slug,
    name: hotel.name,
    city: hotel.city,
    state: hotel.state,
    address: hotel.address,
    coverImageUrl: hotel.image,
    shortDescription: hotel.shortDescription,
  };
}

function getFallbackResults(query: string) {
  if (!canUseDevelopmentFallback) {
    return [];
  }

  return fallbackHotels.filter((hotel) => matchesHotelQuery(hotel, query)).map(mapFallbackResult);
}

function buildDestinationSuggestions(results: HotelSearchResult[], query: string) {
  const seen = new Set<string>();

  return results.flatMap((hotel) => {
    const destinations = [
      {
        label: `${hotel.city}, ${hotel.state}`,
        description: "Destino",
      },
      {
        label: hotel.state,
        description: "Estado",
      },
    ];

    return destinations
      .filter((destination) => matchesHotelQuery({ ...hotel, name: destination.label }, query))
      .filter((destination) => {
        const key = normalizeText(destination.label);

        if (seen.has(key)) {
          return false;
        }

        seen.add(key);
        return true;
      })
      .map((destination) => ({
        id: `destination-${normalizeText(destination.label).replace(/\s+/g, "-")}`,
        type: "destination" as const,
        label: destination.label,
        description: destination.description,
        href: getSearchHref(destination.label),
      }));
  });
}

export async function searchPublishedHotels(query: string, limit = MAX_RESULTS) {
  const safeQuery = normalizeHotelSearchQuery(query);

  if (safeQuery.length < 2) {
    return [];
  }

  try {
    return await prisma.hotel.findMany({
      where: {
        isPublished: true,
        OR: [
          { name: { contains: safeQuery, mode: "insensitive" } },
          { city: { contains: safeQuery, mode: "insensitive" } },
          { state: { contains: safeQuery, mode: "insensitive" } },
          { address: { contains: safeQuery, mode: "insensitive" } },
          { shortDescription: { contains: safeQuery, mode: "insensitive" } },
          { fullDescription: { contains: safeQuery, mode: "insensitive" } },
        ],
      },
      select: {
        slug: true,
        name: true,
        city: true,
        state: true,
        address: true,
        coverImageUrl: true,
        shortDescription: true,
      },
      orderBy: [{ city: "asc" }, { name: "asc" }],
      take: limit,
    });
  } catch (error) {
    if (canUseDevelopmentFallback) {
      return getFallbackResults(safeQuery).slice(0, limit);
    }

    throw error;
  }
}

export async function getHotelSearchSuggestions(query: string) {
  const safeQuery = normalizeHotelSearchQuery(query);
  const results = await searchPublishedHotels(safeQuery, MAX_SUGGESTIONS);
  const hotelSuggestions = results.slice(0, 5).map((hotel) => ({
    id: `hotel-${hotel.slug}`,
    type: "hotel" as const,
    label: hotel.name,
    description: `${hotel.city}, ${hotel.state}`,
    href: `/hoteis/${hotel.slug}`,
  }));
  const destinationSuggestions = buildDestinationSuggestions(results, safeQuery);

  return [...hotelSuggestions, ...destinationSuggestions].slice(0, MAX_SUGGESTIONS);
}
