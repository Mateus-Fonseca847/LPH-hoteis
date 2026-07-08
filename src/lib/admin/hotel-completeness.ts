export type HotelCompletenessInput = {
  address: string | null;
  amenities: { id: string }[];
  checkInTime?: string | null;
  checkOutTime?: string | null;
  coverImageUrl: string | null;
  email: string | null;
  fullDescription: string | null;
  images: { id: string }[];
  name: string | null;
  phone: string | null;
  policies: { id: string }[];
  rooms: {
    availability: { id: string }[];
    rates: { id: string }[];
    units?: number | null;
    totalUnits?: number | null;
    unitCount?: number | null;
  }[];
  shortDescription: string | null;
  whatsapp: string | null;
};

export type HotelCompletenessResult = {
  pending: string[];
  percentage: number;
};

function hasText(value: string | null | undefined) {
  return Boolean(value?.trim());
}

function getRoomDefaultUnits(room: {
  units?: number | null;
  totalUnits?: number | null;
  unitCount?: number | null;
}) {
  const unitCount = room.units ?? room.totalUnits ?? room.unitCount ?? 1;

  return Number.isInteger(unitCount) && unitCount > 0 ? unitCount : 0;
}

export function getHotelCompletenessSelect(referenceDate: Date) {
  return {
    name: true,
    shortDescription: true,
    fullDescription: true,
    address: true,
    phone: true,
    email: true,
    whatsapp: true,
    coverImageUrl: true,
    checkInTime: true,
    checkOutTime: true,
    images: {
      select: {
        id: true,
      },
      take: 1,
    },
    amenities: {
      select: {
        id: true,
      },
      take: 1,
    },
    policies: {
      select: {
        id: true,
      },
      take: 1,
    },
    rooms: {
      where: {
        isActive: true,
      },
      select: {
        units: true,
        rates: {
          where: {
            isActive: true,
          },
          select: {
            id: true,
          },
          take: 1,
        },
        availability: {
          where: {
            date: {
              gte: referenceDate,
            },
            closed: false,
            availableUnits: {
              gt: 0,
            },
          },
          select: {
            id: true,
          },
          take: 1,
        },
      },
    },
  } as const;
}

export function calculateHotelCompleteness(hotel: HotelCompletenessInput): HotelCompletenessResult {
  const checks = [
    { done: hasText(hotel.name), label: "Nome" },
    { done: hasText(hotel.shortDescription), label: "Descrição curta" },
    { done: hasText(hotel.fullDescription), label: "Descrição completa" },
    { done: hasText(hotel.address), label: "Endereço" },
    {
      done: hasText(hotel.phone) && hasText(hotel.email) && hasText(hotel.whatsapp),
      label: "Contato",
    },
    { done: hasText(hotel.coverImageUrl), label: "Imagem de capa" },
    { done: hotel.images.length > 0, label: "Galeria" },
    { done: hotel.amenities.length > 0, label: "Comodidades" },
    { done: hotel.policies.length > 0, label: "Políticas" },
    { done: hotel.rooms.length > 0, label: "Quartos ativos" },
    { done: hotel.rooms.some((room) => room.rates.length > 0), label: "Tarifas ativas" },
    {
      done: hotel.rooms.some((room) => getRoomDefaultUnits(room) > 0),
      label: "Disponibilidade futura",
    },
  ];

  const completed = checks.filter((check) => check.done).length;

  return {
    pending: checks.filter((check) => !check.done).map((check) => check.label),
    percentage: Math.round((completed / checks.length) * 100),
  };
}
