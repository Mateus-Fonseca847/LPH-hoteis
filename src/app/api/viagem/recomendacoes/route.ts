import {
  createApiErrorResponse,
  createApiSuccessResponse,
  ValidationError,
} from "@/lib/errors/app-error";
import {
  recommendHotels,
  type TripRecommendationInput,
  type TripType,
} from "@/lib/trip-recommendations";

const RECOMMENDATION_FAILURE = "Não foi possível gerar recomendações.";
const tripTypes: TripType[] = ["Lazer", "Família", "Casal", "Negócios", "Aventura"];
const preferenceOptions = ["Praia", "Serra", "Urbano", "Descanso", "Gastronomia", "Eventos"];

function readString(value: unknown, maxLength = 100) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, maxLength) : "";
}

function readInteger(value: unknown, fallback: number, min: number, max: number) {
  const number = typeof value === "number" ? value : Number(value);

  if (!Number.isInteger(number)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, number));
}

function parseInput(payload: unknown): TripRecommendationInput {
  if (!payload || typeof payload !== "object") {
    throw new ValidationError("Dados da viagem inválidos.");
  }

  const data = payload as Record<string, unknown>;
  const destination = readString(data.destination, 80);
  const tripType = readString(data.tripType, 30) as TripType;

  if (destination.length < 2) {
    throw new ValidationError("Informe um destino com pelo menos 2 caracteres.");
  }

  if (!tripTypes.includes(tripType)) {
    throw new ValidationError("Tipo de viagem inválido.");
  }

  const preferences = Array.isArray(data.preferences)
    ? data.preferences
        .map((preference) => readString(preference, 30))
        .filter((preference) => preferenceOptions.includes(preference))
    : [];

  return {
    destination,
    tripType,
    budget: readString(data.budget, 30),
    adults: readInteger(data.adults, 2, 1, 12),
    children: readInteger(data.children, 0, 0, 12),
    startDate: readString(data.startDate, 10) || undefined,
    endDate: readString(data.endDate, 10) || undefined,
    preferences,
  };
}

export async function POST(request: Request) {
  try {
    const input = parseInput(await request.json().catch(() => null));
    const recommendations = await recommendHotels(input);

    return createApiSuccessResponse({
      recommendations,
    });
  } catch (error) {
    return createApiErrorResponse(error, RECOMMENDATION_FAILURE);
  }
}
