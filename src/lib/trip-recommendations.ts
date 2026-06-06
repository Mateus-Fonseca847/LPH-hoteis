import { hotels as fallbackHotels } from "@/data/hotels";
import { normalizeText } from "@/lib/normalize-text";
import { prisma } from "@/lib/prisma";

export type TripType = "Lazer" | "Família" | "Casal" | "Negócios" | "Aventura";

export type TripRecommendationInput = {
  destination: string;
  tripType: TripType;
  budget: string;
  adults: number;
  children: number;
  startDate?: string;
  endDate?: string;
  preferences: string[];
};

export type TripRecommendedHotel = {
  slug: string;
  name: string;
  city: string;
  state: string;
  address: string;
  coverImageUrl: string;
  score: number;
  reason: string;
  estimatedPriceCents: number | null;
};

type RecommendationHotel = {
  slug: string;
  name: string;
  city: string;
  state: string;
  address: string;
  shortDescription: string;
  fullDescription: string;
  coverImageUrl: string;
  amenities: string[];
  rooms: Array<{
    capacity: number;
    capacityAdults: number;
    capacityChildren: number;
    priceFromCents: number;
    lowestRateCents: number | null;
    amenities: string[];
    availability: Array<{
      date: string;
      availableUnits: number;
      closed: boolean;
    }>;
  }>;
};

const MAX_RECOMMENDATIONS = 6;
const canUseDevelopmentFallback =
  process.env.NODE_ENV === "development" && process.env.ALLOW_LOCAL_HOTEL_DATA_FALLBACK === "true";

const profileKeywords: Record<TripType, string[]> = {
  Lazer: ["piscina", "praia", "lazer", "bar", "cafe", "restaurante", "descanso"],
  Família: ["crianca", "familia", "piscina", "estacionamento", "cafe", "lounge", "amplo"],
  Casal: ["casal", "romant", "spa", "vista", "restaurante", "adega", "lareira", "privacidade"],
  Negócios: ["negocio", "executivo", "coworking", "reuniao", "valet", "transfer", "urbano"],
  Aventura: ["aventura", "trilha", "serra", "parque", "praia", "natureza", "mirante"],
};

const preferenceKeywords: Record<string, string[]> = {
  Praia: ["praia", "orla", "mar", "litoral", "beira-mar"],
  Serra: ["serra", "montanha", "lareira", "trilha", "natureza"],
  Urbano: ["urbano", "centro", "shopping", "jardins", "cidade", "capital"],
  Descanso: ["descanso", "spa", "serena", "tranquil", "piscina", "privacidade"],
  Gastronomia: ["gastronomia", "restaurante", "bar", "adega", "cafe"],
  Eventos: ["evento", "convencao", "reuniao", "auditório", "coworking"],
};

function getBudgetLimitCents(budget: string) {
  if (budget.includes("800") && budget.includes("Até")) {
    return 80000;
  }

  if (budget.includes("1.500")) {
    return 150000;
  }

  if (budget.includes("3.000")) {
    return budget.includes("Acima") ? null : 300000;
  }

  return null;
}

function getNightsBetween(startDate?: string, endDate?: string) {
  if (!startDate || !endDate) {
    return [];
  }

  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return [];
  }

  const dates: string[] = [];
  const cursor = new Date(start);

  while (cursor < end && dates.length < 31) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

function includesAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(normalizeText(keyword)));
}

function getHotelText(hotel: RecommendationHotel) {
  return normalizeText(
    [
      hotel.name,
      hotel.city,
      hotel.state,
      hotel.address,
      hotel.shortDescription,
      hotel.fullDescription,
      ...hotel.amenities,
      ...hotel.rooms.flatMap((room) => room.amenities),
    ].join(" ")
  );
}

function hasCompatibleAvailability(room: RecommendationHotel["rooms"][number], nights: string[]) {
  if (nights.length === 0) {
    return true;
  }

  const availabilityByDate = new Map(room.availability.map((entry) => [entry.date, entry]));

  return nights.every((date) => {
    const entry = availabilityByDate.get(date);

    return entry ? !entry.closed && entry.availableUnits > 0 : true;
  });
}

function hasConfirmedAvailability(room: RecommendationHotel["rooms"][number], nights: string[]) {
  if (nights.length === 0) {
    return false;
  }

  const availabilityByDate = new Map(room.availability.map((entry) => [entry.date, entry]));

  return nights.every((date) => {
    const entry = availabilityByDate.get(date);

    return entry ? !entry.closed && entry.availableUnits > 0 : false;
  });
}

function getRoomPriceCents(room: RecommendationHotel["rooms"][number]) {
  return room.lowestRateCents ?? room.priceFromCents;
}

function scoreHotel(hotel: RecommendationHotel, input: TripRecommendationInput) {
  const destination = normalizeText(input.destination);
  const text = getHotelText(hotel);
  const totalGuests = input.adults + input.children;
  const nights = getNightsBetween(input.startDate, input.endDate);
  const budgetLimitCents = getBudgetLimitCents(input.budget);
  const reasons: string[] = [];
  let score = 0;

  if (normalizeText(`${hotel.city}, ${hotel.state}`).includes(destination)) {
    score += 36;
    reasons.push(`fica em ${hotel.city}, ${hotel.state}`);
  } else if (
    [hotel.city, hotel.state, hotel.address, hotel.name].some((value) =>
      normalizeText(value).includes(destination)
    )
  ) {
    score += 28;
    reasons.push("combina com o destino buscado");
  } else if (text.includes(destination)) {
    score += 16;
  }

  const compatibleRooms = hotel.rooms.filter(
    (room) =>
      room.capacity >= totalGuests &&
      room.capacityAdults >= input.adults &&
      room.capacityChildren >= input.children
  );

  if (compatibleRooms.length > 0) {
    score += 20;
    reasons.push("tem quartos compatíveis com o grupo");
  }

  const availableRooms = compatibleRooms.filter((room) => hasCompatibleAvailability(room, nights));
  const confirmedAvailableRooms = compatibleRooms.filter((room) =>
    hasConfirmedAvailability(room, nights)
  );

  if (confirmedAvailableRooms.length > 0) {
    score += 16;
    reasons.push("tem disponibilidade cadastrada para consulta nas datas");
  }

  const pricedRooms = (availableRooms.length > 0 ? availableRooms : compatibleRooms).filter(
    (room) => getRoomPriceCents(room) > 0
  );

  if (budgetLimitCents && pricedRooms.some((room) => getRoomPriceCents(room) <= budgetLimitCents)) {
    score += 14;
    reasons.push("encaixa na faixa de orçamento");
  }

  const profileMatches = profileKeywords[input.tripType].filter((keyword) =>
    text.includes(normalizeText(keyword))
  );

  if (profileMatches.length > 0) {
    score += Math.min(18, profileMatches.length * 5);
    reasons.push(`tem perfil de ${input.tripType.toLowerCase()}`);
  }

  const preferenceMatches = input.preferences.filter((preference) =>
    includesAny(text, preferenceKeywords[preference] ?? [preference])
  );

  if (preferenceMatches.length > 0) {
    score += Math.min(18, preferenceMatches.length * 6);
    reasons.push(`atende preferências como ${preferenceMatches.slice(0, 2).join(" e ")}`);
  }

  if (input.children > 0 && includesAny(text, profileKeywords.Família)) {
    score += 8;
  }

  return {
    score,
    reasons,
  };
}

function getEstimatedPriceCents(hotel: RecommendationHotel, input: TripRecommendationInput) {
  const totalGuests = input.adults + input.children;
  const nights = getNightsBetween(input.startDate, input.endDate);
  const compatibleRooms = hotel.rooms.filter(
    (room) =>
      room.capacity >= totalGuests &&
      room.capacityAdults >= input.adults &&
      room.capacityChildren >= input.children
  );
  const availableRooms = compatibleRooms.filter((room) => hasCompatibleAvailability(room, nights));
  const candidateRooms = availableRooms.length > 0 ? availableRooms : compatibleRooms;
  const prices = candidateRooms.map(getRoomPriceCents).filter((price) => price > 0);

  return prices.length > 0 ? Math.min(...prices) : null;
}

function buildReason(reasons: string[]) {
  const uniqueReasons = Array.from(new Set(reasons)).slice(0, 3);

  if (uniqueReasons.length === 0) {
    return "Boa opção inicial para comparar com o perfil informado.";
  }

  return `Recomendado porque ${uniqueReasons.join(", ")}.`;
}

function mapFallbackHotel(hotel: (typeof fallbackHotels)[number]): RecommendationHotel {
  return {
    slug: hotel.slug,
    name: hotel.name,
    city: hotel.city,
    state: hotel.state,
    address: hotel.address,
    shortDescription: hotel.shortDescription,
    fullDescription: hotel.fullDescription,
    coverImageUrl: hotel.image,
    amenities: hotel.amenities,
    rooms: [],
  };
}

async function getRecommendationHotels() {
  try {
    const now = new Date();

    const hotels = await prisma.hotel.findMany({
      where: {
        isPublished: true,
      },
      include: {
        amenities: {
          orderBy: {
            position: "asc",
          },
          select: {
            label: true,
          },
        },
        rooms: {
          where: {
            isActive: true,
            isAvailable: true,
          },
          include: {
            rates: {
              where: {
                isActive: true,
                endDate: {
                  gte: now,
                },
              },
              select: {
                priceCents: true,
              },
            },
            availability: {
              where: {
                date: {
                  gte: now,
                },
              },
              select: {
                date: true,
                availableUnits: true,
                closed: true,
              },
            },
          },
        },
      },
      take: 80,
    });

    return hotels.map<RecommendationHotel>((hotel) => ({
      slug: hotel.slug,
      name: hotel.name,
      city: hotel.city,
      state: hotel.state,
      address: hotel.address,
      shortDescription: hotel.shortDescription,
      fullDescription: hotel.fullDescription,
      coverImageUrl: hotel.coverImageUrl,
      amenities: hotel.amenities.map((amenity) => amenity.label),
      rooms: hotel.rooms.map((room) => ({
        capacity: room.capacity,
        capacityAdults: room.capacityAdults,
        capacityChildren: room.capacityChildren,
        priceFromCents: Math.round(Number(room.priceFrom.toString()) * 100),
        lowestRateCents:
          room.rates.length > 0 ? Math.min(...room.rates.map((rate) => rate.priceCents)) : null,
        amenities: room.amenities,
        availability: room.availability.map((entry) => ({
          date: entry.date.toISOString().slice(0, 10),
          availableUnits: entry.availableUnits,
          closed: entry.closed,
        })),
      })),
    }));
  } catch (error) {
    if (canUseDevelopmentFallback) {
      return fallbackHotels.map(mapFallbackHotel);
    }

    throw error;
  }
}

export async function recommendHotels(input: TripRecommendationInput) {
  const hotels = await getRecommendationHotels();

  return hotels
    .map((hotel) => {
      const { score, reasons } = scoreHotel(hotel, input);

      return {
        slug: hotel.slug,
        name: hotel.name,
        city: hotel.city,
        state: hotel.state,
        address: hotel.address,
        coverImageUrl: hotel.coverImageUrl,
        score,
        reason: buildReason(reasons),
        estimatedPriceCents: getEstimatedPriceCents(hotel, input),
      };
    })
    .filter((hotel) => hotel.score > 0)
    .sort((first, second) => second.score - first.score || first.name.localeCompare(second.name))
    .slice(0, MAX_RECOMMENDATIONS);
}
