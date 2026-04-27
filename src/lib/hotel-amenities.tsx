type HotelAmenityOption = {
  id: string;
  label: string;
  aliases?: string[];
};

export const HOTEL_AMENITY_OPTIONS: HotelAmenityOption[] = [
  { id: "wifi", label: "Wi‑Fi", aliases: ["wifi", "wi-fi", "internet", "wi fi premium"] },
  { id: "breakfast", label: "Café da manhã", aliases: ["cafe da manha", "breakfast"] },
  { id: "parking", label: "Estacionamento", aliases: ["parking", "garagem", "valet"] },
  { id: "pool", label: "Piscina", aliases: ["pool"] },
  { id: "gym", label: "Academia", aliases: ["gym", "fitness"] },
  { id: "spa", label: "Spa" },
  { id: "restaurant", label: "Restaurante" },
  { id: "bar", label: "Bar", aliases: ["bar de vinhos"] },
  { id: "front-desk-24h", label: "Recepção 24h", aliases: ["recepcao 24h", "atendimento 24h"] },
  { id: "air-conditioning", label: "Ar-condicionado", aliases: ["ar condicionado"] },
  {
    id: "room-service",
    label: "Serviço de quarto",
    aliases: ["servico de quarto", "room service"],
  },
  { id: "laundry", label: "Lavanderia" },
  { id: "airport-transfer", label: "Transfer/Aeroporto", aliases: ["transfer", "aeroporto"] },
  { id: "pet-friendly", label: "Pet friendly", aliases: ["pet"] },
  { id: "accessibility", label: "Acessibilidade", aliases: ["adaptado"] },
  { id: "meeting-room", label: "Sala de reuniões", aliases: ["eventos"] },
  { id: "coworking", label: "Espaço coworking", aliases: ["espaco coworking", "coworking"] },
  { id: "concierge", label: "Concierge" },
  { id: "minibar", label: "Frigobar" },
  { id: "tv", label: "TV", aliases: ["televisao"] },
  { id: "safe", label: "Cofre" },
  { id: "balcony", label: "Varanda" },
  { id: "sea-view", label: "Vista para o mar", aliases: ["vista mar", "vista para mar"] },
  { id: "kids-area", label: "Área kids", aliases: ["area kids", "kids"] },
  { id: "sauna", label: "Sauna" },
  { id: "jacuzzi", label: "Jacuzzi", aliases: ["hidromassagem"] },
  { id: "private-beach", label: "Praia privativa", aliases: ["beach club"] },
  { id: "kitchenette", label: "Cozinha compacta", aliases: ["cozinha", "kitchenette"] },
  {
    id: "daily-housekeeping",
    label: "Serviço de limpeza diário",
    aliases: ["limpeza diaria", "housekeeping"],
  },
  { id: "express-checkin", label: "Check-in expresso", aliases: ["check in expresso"] },
];

function normalizeAmenityValue(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function findAmenityOptionByLabel(label: string) {
  const normalized = normalizeAmenityValue(label);

  return HOTEL_AMENITY_OPTIONS.find((option) => {
    if (normalizeAmenityValue(option.label) === normalized) {
      return true;
    }

    return option.aliases?.some((alias) => normalizeAmenityValue(alias) === normalized);
  });
}

export function getCanonicalAmenityLabel(label: string) {
  return findAmenityOptionByLabel(label)?.label ?? label.trim();
}

export function HotelAmenityIcon({
  amenityId,
  label,
}: {
  amenityId?: string | null;
  label?: string;
}) {
  const resolvedId = amenityId ?? (label ? findAmenityOptionByLabel(label)?.id : undefined);

  switch (resolvedId) {
    case "wifi":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 9a14.5 14.5 0 0 1 18 0M6 12.5a9.5 9.5 0 0 1 12 0M9.5 16a4.5 4.5 0 0 1 5 0M12 19h.01" />
        </svg>
      );
    case "breakfast":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 8h10v5a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8Zm10 1h2a2.5 2.5 0 0 1 0 5h-2M7 4v2M10 3v3M13 4v2M4 20h12" />
        </svg>
      );
    case "parking":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 20V4h6a4 4 0 0 1 0 8H7m0-8v8m0-4h5" />
        </svg>
      );
    case "pool":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 15c1.3 0 1.9-.8 2.5-1.4.6-.6 1.2-1.1 2.5-1.1s1.9.5 2.5 1.1c.6.6 1.2 1.4 2.5 1.4s1.9-.8 2.5-1.4c.6-.6 1.2-1.1 2.5-1.1s1.9.5 2.5 1.1c.6.6 1.2 1.4 2.5 1.4M3 19c1.3 0 1.9-.8 2.5-1.4.6-.6 1.2-1.1 2.5-1.1s1.9.5 2.5 1.1c.6.6 1.2 1.4 2.5 1.4s1.9-.8 2.5-1.4c.6-.6 1.2-1.1 2.5-1.1s1.9.5 2.5 1.1c.6.6 1.2 1.4 2.5 1.4" />
        </svg>
      );
    case "gym":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 10v4M6 8v8M9 9v6M15 9v6M18 8v8M21 10v4M9 12h6" />
        </svg>
      );
    case "spa":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 21c4-2.5 6-5.4 6-8.3A3.7 3.7 0 0 0 14.4 9c-1 0-1.8.4-2.4 1.1C11.4 9.4 10.6 9 9.6 9A3.7 3.7 0 0 0 6 12.7C6 15.6 8 18.5 12 21ZM12 7c0-1.9 1.2-3.2 3-4" />
        </svg>
      );
    case "restaurant":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 3v8M4 3v4M8 3v4M6 11v10M15 3v18M15 3c2 0 4 2 4 5v2h-4" />
        </svg>
      );
    case "bar":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 5h14l-5.5 6v5l-3 2v-7L5 5Zm4 15h6" />
        </svg>
      );
    case "front-desk-24h":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
      );
    case "air-conditioning":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 8h16M6 12h12M8 16h8M12 8v10M9 19l3-1 3 1" />
        </svg>
      );
    case "room-service":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 14h16a4 4 0 0 0-8-4 4 4 0 0 0-8 4Zm1 0v3h14v-3M3 20h18" />
        </svg>
      );
    case "laundry":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 4h14v16H5zM8 7h.01M11 7h.01M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
        </svg>
      );
    case "airport-transfer":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m3 14 8.5-2.5L14 4l2 1-1.5 6 5 1.5v2l-5-1.5L16 19l-2 1-2.5-7L3 16v-2Z" />
        </svg>
      );
    case "pet-friendly":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 11a2 2 0 1 1-2-2 2 2 0 0 1 2 2Zm5-3a2 2 0 1 1-2-2 2 2 0 0 1 2 2Zm6 3a2 2 0 1 1-2-2 2 2 0 0 1 2 2ZM12 20c-3.4 0-5.5-1.6-5.5-4 0-1.9 1.5-3.5 3.4-3.5.8 0 1.5.3 2.1.8.6-.5 1.3-.8 2.1-.8 1.9 0 3.4 1.6 3.4 3.5 0 2.4-2.1 4-5.5 4Z" />
        </svg>
      );
    case "accessibility":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 5h.01M10 8h4M12 9v5m0 0 4 6m-4-6-4 6m4-6H8" />
          <circle cx="12" cy="5" r="1.5" />
        </svg>
      );
    case "meeting-room":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 7h16v10H4zM8 20v-3M16 20v-3M9 11h6" />
        </svg>
      );
    case "coworking":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 18v-7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v7M8 18v-4h8v4M9 7V5h6v2" />
        </svg>
      );
    case "concierge":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 14a8 8 0 0 1 16 0M3 14h18M5 18h14M8 18v2M16 18v2" />
        </svg>
      );
    case "minibar":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 4h10v16H7zM9 8h6M12 4v16" />
        </svg>
      );
    case "tv":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 6h16v11H4zM9 20h6M12 17v3" />
        </svg>
      );
    case "safe":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 5h14v14H5zM12 12h.01M12 9v6M9 12h6" />
        </svg>
      );
    case "balcony":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 20h16M6 20V9h12v11M9 9V5h6v4M9 13h6" />
        </svg>
      );
    case "sea-view":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 8c2.2 0 3.4-1.5 4-3 1 1.8 2.3 3 4 3s3-1.2 4-3c.6 1.5 1.8 3 4 3M3 17c1.3 0 1.9-.8 2.5-1.4.6-.6 1.2-1.1 2.5-1.1s1.9.5 2.5 1.1c.6.6 1.2 1.4 2.5 1.4s1.9-.8 2.5-1.4c.6-.6 1.2-1.1 2.5-1.1s1.9.5 2.5 1.1c.6.6 1.2 1.4 2.5 1.4" />
        </svg>
      );
    case "kids-area":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 6a2 2 0 1 1 0 4 2 2 0 0 1 0-4Zm-5 13 2-5 3 2 3-2 2 5M9 12l-2-2M15 12l2-2" />
        </svg>
      );
    case "sauna":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 20v-6h12v6M8 14V9M12 14V7M16 14V9M7 5c0-1 .5-1.5 1.5-2M12 4c0-1 .5-1.5 1.5-2M17 5c0-1 .5-1.5 1.5-2" />
        </svg>
      );
    case "jacuzzi":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 15h16v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3Zm3-3V9a2 2 0 0 1 4 0v3M13 12V8a2 2 0 0 1 4 0v4" />
        </svg>
      );
    case "private-beach":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3v8M8 7h8M5 20c1.3 0 1.9-.8 2.5-1.4.6-.6 1.2-1.1 2.5-1.1s1.9.5 2.5 1.1c.6.6 1.2 1.4 2.5 1.4s1.9-.8 2.5-1.4c.6-.6 1.2-1.1 2.5-1.1" />
        </svg>
      );
    case "kitchenette":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 7h16v13H4zM8 7V4h8v3M8 12h8M7 16h.01M17 16h.01" />
        </svg>
      );
    case "daily-housekeeping":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 20h4l7-7-4-4-7 7v4Zm9-11 2-2 3 3-2 2M4 20h16" />
        </svg>
      );
    case "express-checkin":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 12h10M10 8l4 4-4 4M15 7h5v10h-5" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m5 12 4 4L19 6" />
        </svg>
      );
  }
}
