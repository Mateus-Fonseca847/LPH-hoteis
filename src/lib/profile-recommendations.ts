export type ProfileRecommendationHotel = {
  slug: string;
  name: string;
  city: string;
  state: string;
  coverImageUrl: string;
};

export type TouristAttractionIconType =
  | "landmark"
  | "nature"
  | "beach"
  | "food"
  | "shopping"
  | "business";

export type ProfileTouristAttraction = {
  name: string;
  type: string;
  approximateDistanceLabel: string;
  optionalDescription?: string;
  iconType: TouristAttractionIconType;
};

export type ProfileExperienceInput = {
  key: string;
  title: string;
  location: string;
  reason: string;
  image: string;
  alt: string;
  query: string;
  destinationCity?: string;
  destinationState?: string;
  relatedTags?: string[];
  touristAttractions?: ProfileTouristAttraction[];
  fallbackHotelSlug?: string;
  matchPriority?: number;
};

export type ProfileExperienceMatch<TExperience extends ProfileExperienceInput> = {
  experience: TExperience;
  hotel: ProfileRecommendationHotel | null;
  href: string;
  image: string;
  ctaLabel: string;
  destinationCity: string;
  destinationState: string;
  touristAttractions: ProfileTouristAttraction[];
  matchLabel: string;
};

const touristAttractionsByDestination: Record<string, ProfileTouristAttraction[]> = {
  "gramado-rs": [
    {
      name: "Rua Coberta",
      type: "Centro turístico",
      approximateDistanceLabel: "a poucos minutos",
      iconType: "landmark",
    },
    {
      name: "Lago Negro",
      type: "Parque",
      approximateDistanceLabel: "próximo de carro",
      iconType: "nature",
    },
    {
      name: "Mini Mundo",
      type: "Atração familiar",
      approximateDistanceLabel: "fácil acesso",
      iconType: "landmark",
    },
  ],
  "florianopolis-sc": [
    {
      name: "Beira-Mar Norte",
      type: "Orla",
      approximateDistanceLabel: "perto da orla",
      iconType: "beach",
    },
    {
      name: "Centro histórico",
      type: "Cultura",
      approximateDistanceLabel: "fácil acesso",
      iconType: "landmark",
    },
    {
      name: "Praias do norte",
      type: "Litoral",
      approximateDistanceLabel: "próximo de carro",
      iconType: "beach",
    },
  ],
  "recife-pe": [
    {
      name: "Praia de Boa Viagem",
      type: "Praia",
      approximateDistanceLabel: "a poucos minutos",
      iconType: "beach",
    },
    {
      name: "Aeroporto",
      type: "Mobilidade",
      approximateDistanceLabel: "próximo de carro",
      iconType: "business",
    },
    {
      name: "Orla gastronômica",
      type: "Gastronomia",
      approximateDistanceLabel: "fácil acesso",
      iconType: "food",
    },
  ],
  "salvador-ba": [
    {
      name: "Pelourinho",
      type: "Centro histórico",
      approximateDistanceLabel: "a poucos minutos",
      iconType: "landmark",
    },
    {
      name: "Museus do centro",
      type: "Cultura",
      approximateDistanceLabel: "fácil acesso",
      iconType: "landmark",
    },
    {
      name: "Restaurantes coloniais",
      type: "Gastronomia",
      approximateDistanceLabel: "perto do centro",
      iconType: "food",
    },
  ],
  "sao-paulo-sp": [
    {
      name: "Avenida Paulista",
      type: "Negócios e cultura",
      approximateDistanceLabel: "fácil acesso",
      iconType: "business",
    },
    {
      name: "Jardins",
      type: "Gastronomia",
      approximateDistanceLabel: "perto do centro",
      iconType: "food",
    },
    {
      name: "Museus e compras",
      type: "Cultura",
      approximateDistanceLabel: "próximo de carro",
      iconType: "shopping",
    },
  ],
  "brasilia-df": [
    {
      name: "Lago Paranoá",
      type: "Lazer",
      approximateDistanceLabel: "a poucos minutos",
      iconType: "nature",
    },
    {
      name: "Centro de convenções",
      type: "Eventos",
      approximateDistanceLabel: "próximo de carro",
      iconType: "business",
    },
    {
      name: "Eixo Monumental",
      type: "Arquitetura",
      approximateDistanceLabel: "fácil acesso",
      iconType: "landmark",
    },
  ],
  "garopaba-sc": [
    {
      name: "Praia central",
      type: "Praia",
      approximateDistanceLabel: "a poucos minutos",
      iconType: "beach",
    },
    {
      name: "Lagoas da região",
      type: "Natureza",
      approximateDistanceLabel: "próximo de carro",
      iconType: "nature",
    },
    {
      name: "Centro local",
      type: "Serviços",
      approximateDistanceLabel: "fácil acesso",
      iconType: "shopping",
    },
  ],
};

const stateFallbackAttractions: Record<string, ProfileTouristAttraction[]> = {
  RJ: [
    {
      name: "Orla e mirantes",
      type: "Passeios",
      approximateDistanceLabel: "fácil acesso",
      iconType: "beach",
    },
    {
      name: "Centro gastronômico",
      type: "Gastronomia",
      approximateDistanceLabel: "próximo de carro",
      iconType: "food",
    },
  ],
  MG: [
    {
      name: "Centro histórico",
      type: "Cultura",
      approximateDistanceLabel: "fácil acesso",
      iconType: "landmark",
    },
    {
      name: "Roteiro gastronômico",
      type: "Gastronomia",
      approximateDistanceLabel: "perto do centro",
      iconType: "food",
    },
  ],
};

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function getDestinationKey(city: string, state: string) {
  return `${normalizeText(city).replace(/[^a-z0-9]+/g, "-")}-${state.trim().toUpperCase()}`;
}

function getDestinationParts(experience: ProfileExperienceInput) {
  if (experience.destinationCity && experience.destinationState) {
    return {
      city: experience.destinationCity,
      state: experience.destinationState.toUpperCase(),
    };
  }

  const [city = experience.query, state = ""] = experience.location
    .split(",")
    .map((part) => part.trim());

  return {
    city,
    state: state.toUpperCase(),
  };
}

function isValidHotelSlug(slug: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

function scoreHotelMatch(
  hotel: ProfileRecommendationHotel,
  experience: ProfileExperienceInput,
  destinationCity: string,
  destinationState: string
) {
  const hotelCity = normalizeText(hotel.city);
  const hotelState = hotel.state.trim().toUpperCase();
  const city = normalizeText(destinationCity);
  const state = destinationState.trim().toUpperCase();
  let score = 0;

  if (hotelCity === city && hotelState === state) {
    score += 100;
  } else if (hotelState === state && state) {
    score += 38;
  }

  if (experience.fallbackHotelSlug && hotel.slug === experience.fallbackHotelSlug) {
    score += 80;
  }

  if (hotel.coverImageUrl) {
    score += 6;
  }

  score += experience.matchPriority ?? 0;

  return score;
}

function findCompatibleHotel(
  hotels: ProfileRecommendationHotel[],
  experience: ProfileExperienceInput,
  destinationCity: string,
  destinationState: string
) {
  return (
    hotels
      .filter((hotel) => isValidHotelSlug(hotel.slug))
      .map((hotel) => ({
        hotel,
        score: scoreHotelMatch(hotel, experience, destinationCity, destinationState),
      }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score || a.hotel.name.localeCompare(b.hotel.name))
      .at(0)?.hotel ?? null
  );
}

function getAttractions(experience: ProfileExperienceInput, city: string, state: string) {
  if (experience.touristAttractions?.length) {
    return experience.touristAttractions.slice(0, 3);
  }

  return (
    touristAttractionsByDestination[getDestinationKey(city, state)] ??
    stateFallbackAttractions[state] ??
    []
  ).slice(0, 3);
}

export function getProfileExperienceMatches<TExperience extends ProfileExperienceInput>({
  recommendations,
  hotels,
}: {
  recommendations: TExperience[];
  hotels: ProfileRecommendationHotel[];
}): Array<ProfileExperienceMatch<TExperience>> {
  return recommendations.map((experience) => {
    const destination = getDestinationParts(experience);
    const hotel = findCompatibleHotel(hotels, experience, destination.city, destination.state);

    return {
      experience,
      hotel,
      href: hotel
        ? `/hoteis/${hotel.slug}`
        : `/buscar?destino=${encodeURIComponent(experience.query)}`,
      image: hotel?.coverImageUrl || experience.image,
      ctaLabel: hotel ? "Ver hotel" : "Explorar hotéis",
      destinationCity: destination.city,
      destinationState: destination.state,
      touristAttractions: getAttractions(experience, destination.city, destination.state),
      matchLabel: hotel ? `${hotel.name} · ${hotel.city}, ${hotel.state}` : experience.location,
    };
  });
}
