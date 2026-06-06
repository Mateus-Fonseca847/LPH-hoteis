export const HOTEL_EXPERIENCE_CATEGORIES = [
  "Esporte",
  "Música",
  "Cinema",
  "Descanso",
  "Gastronomia",
  "Natureza",
  "Família",
  "Negócios",
] as const;

export const HOTEL_EXPERIENCE_PREFERENCES = [
  "praia",
  "serra",
  "piscina",
  "café da manhã",
  "pet friendly",
  "crianças",
  "Wi-Fi",
  "estacionamento",
  "restaurante",
  "vista bonita",
  "localização central",
  "tranquilidade",
] as const;

export type HotelExperienceCategory = (typeof HOTEL_EXPERIENCE_CATEGORIES)[number];
export type HotelExperiencePreference = (typeof HOTEL_EXPERIENCE_PREFERENCES)[number];
