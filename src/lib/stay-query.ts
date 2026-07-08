const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type StayDateInput = Date | string;

export type RoomCapacitySnapshot = {
  id?: string;
  units?: number;
  totalUnits?: number;
  unitCount?: number;
  capacity: number;
  capacityAdults: number;
  capacityChildren: number;
};

export type RoomAvailabilitySnapshot = {
  date: StayDateInput;
  availableUnits: number;
  closed: boolean;
};

export type StayAvailabilityStatus = "available" | "unavailable" | "unknown";

export type RoomRateSnapshot = {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  currency: string;
  startDate: StayDateInput;
  endDate: StayDateInput;
  minNights: number;
  maxGuests: number;
  refundable: boolean;
  breakfastIncluded: boolean;
};

export type RoomStayPriceEstimate = {
  rateId: string;
  rateName: string;
  nightlyPriceCents: number;
  totalPriceCents: number;
  currency: string;
  nights: number;
  refundable: boolean;
  breakfastIncluded: boolean;
};

function toUtcDateOnly(input: StayDateInput) {
  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) {
      throw new Error("Data inválida.");
    }

    return Date.UTC(input.getFullYear(), input.getMonth(), input.getDate());
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    throw new Error("Data inválida.");
  }

  const [year, month, day] = input.split("-").map(Number);
  const utcDate = Date.UTC(year, month - 1, day);
  const parsed = new Date(utcDate);

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error("Data inválida.");
  }

  return utcDate;
}

function validateGuests(adults: number, children: number) {
  if (!Number.isInteger(adults) || adults < 1) {
    throw new Error("Adultos deve ser pelo menos 1.");
  }

  if (!Number.isInteger(children) || children < 0) {
    throw new Error("Crianças deve ser 0 ou mais.");
  }
}

export function calculateStayNights(checkIn: StayDateInput, checkOut: StayDateInput) {
  const checkInUtc = toUtcDateOnly(checkIn);
  const checkOutUtc = toUtcDateOnly(checkOut);
  const diffDays = Math.round((checkOutUtc - checkInUtc) / MS_PER_DAY);

  if (diffDays < 1) {
    throw new Error("Check-out deve ser posterior ao check-in.");
  }

  return diffDays;
}

export function calculateTotalGuests(adults: number, children: number) {
  validateGuests(adults, children);
  return adults + children;
}

export function canRoomAccommodateGuests(
  room: RoomCapacitySnapshot,
  adults: number,
  children: number
) {
  validateGuests(adults, children);

  if (!Number.isInteger(room.capacity) || room.capacity < 1) {
    throw new Error("Capacidade total do quarto inválida.");
  }

  if (!Number.isInteger(room.capacityAdults) || room.capacityAdults < 0) {
    throw new Error("Capacidade de adultos do quarto inválida.");
  }

  if (!Number.isInteger(room.capacityChildren) || room.capacityChildren < 0) {
    throw new Error("Capacidade de crianças do quarto inválida.");
  }

  const totalGuests = calculateTotalGuests(adults, children);

  return (
    adults <= room.capacityAdults &&
    children <= room.capacityChildren &&
    totalGuests <= room.capacity
  );
}

export function formatPriceInBRL(priceCents: number) {
  if (!Number.isInteger(priceCents) || priceCents < 0) {
    throw new Error("Preço inválido.");
  }

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(priceCents / 100);
}

export function getStayDates(checkIn: StayDateInput, checkOut: StayDateInput) {
  const nights = calculateStayNights(checkIn, checkOut);
  const checkInUtc = toUtcDateOnly(checkIn);

  return Array.from({ length: nights }, (_, index) => {
    const date = new Date(checkInUtc + index * MS_PER_DAY);
    return date.toISOString().slice(0, 10);
  });
}

function getRoomDefaultUnits(room: RoomCapacitySnapshot) {
  const unitCount = room.units ?? room.totalUnits ?? room.unitCount ?? 1;

  return Number.isInteger(unitCount) && unitCount > 0 ? unitCount : 1;
}

function logPublicAvailabilityCheck({
  roomId,
  checkIn,
  checkOut,
  expectedNights,
  recordsFound,
  missingDays,
  closedDays,
  noUnitDays,
  status,
}: {
  roomId: string;
  checkIn: StayDateInput;
  checkOut: StayDateInput;
  expectedNights: number;
  recordsFound: number;
  missingDays: number;
  closedDays: number;
  noUnitDays: number;
  status: StayAvailabilityStatus;
}) {
  console.info("[availability/public/check]", {
    roomId,
    period: {
      checkIn: checkIn instanceof Date ? checkIn.toISOString().slice(0, 10) : checkIn,
      checkOut: checkOut instanceof Date ? checkOut.toISOString().slice(0, 10) : checkOut,
    },
    expectedNights,
    recordsFound,
    missingDays,
    closedDays,
    noUnitDays,
    status,
  });
}

export function getRoomStayAvailabilityStatus(
  room: RoomCapacitySnapshot & {
    availability?: RoomAvailabilitySnapshot[];
  },
  checkIn: StayDateInput,
  checkOut: StayDateInput,
  adults: number,
  children: number
): StayAvailabilityStatus {
  const stayDates = getStayDates(checkIn, checkOut);
  const availability = room.availability ?? [];
  const availabilityByDate = new Map(
    availability.map((entry) => [
      new Date(toUtcDateOnly(entry.date)).toISOString().slice(0, 10),
      entry,
    ])
  );
  const periodAvailability = stayDates
    .map((date) => availabilityByDate.get(date))
    .filter((entry): entry is RoomAvailabilitySnapshot => Boolean(entry));
  const missingDays = Math.max(stayDates.length - periodAvailability.length, 0);
  const closedDays = periodAvailability.filter((entry) => entry.closed).length;
  const noUnitDays = periodAvailability.filter((entry) => entry.availableUnits < 1).length;
  const defaultUnits = getRoomDefaultUnits(room);
  const logStatus = (status: StayAvailabilityStatus) => {
    logPublicAvailabilityCheck({
      roomId: room.id ?? "unknown",
      checkIn,
      checkOut,
      expectedNights: stayDates.length,
      recordsFound: periodAvailability.length,
      missingDays,
      closedDays,
      noUnitDays,
      status,
    });

    return status;
  };

  if (!canRoomAccommodateGuests(room, adults, children)) {
    return logStatus("unavailable");
  }

  if (closedDays > 0 || noUnitDays > 0) {
    return logStatus("unavailable");
  }

  return logStatus(defaultUnits > 0 ? "available" : "unavailable");
}

export function getRoomStayPriceEstimate(
  room: RoomCapacitySnapshot & {
    rates?: RoomRateSnapshot[];
  },
  checkIn: StayDateInput,
  checkOut: StayDateInput,
  adults: number,
  children: number
): RoomStayPriceEstimate | null {
  if (!canRoomAccommodateGuests(room, adults, children)) {
    return null;
  }

  const nights = calculateStayNights(checkIn, checkOut);
  const totalGuests = calculateTotalGuests(adults, children);
  const stayDates = getStayDates(checkIn, checkOut);
  const stayStart = stayDates[0];
  const stayEnd = stayDates[stayDates.length - 1];
  const rates = room.rates ?? [];

  const compatibleRates = rates.filter((rate) => {
    if (rate.currency !== "BRL") {
      return false;
    }

    if (!Number.isInteger(rate.priceCents) || rate.priceCents < 0) {
      return false;
    }

    if (!Number.isInteger(rate.minNights) || rate.minNights < 1 || nights < rate.minNights) {
      return false;
    }

    if (!Number.isInteger(rate.maxGuests) || rate.maxGuests < totalGuests) {
      return false;
    }

    const rateStart = new Date(toUtcDateOnly(rate.startDate)).toISOString().slice(0, 10);
    const rateEnd = new Date(toUtcDateOnly(rate.endDate)).toISOString().slice(0, 10);

    return rateStart <= stayStart && rateEnd >= stayEnd;
  });

  if (compatibleRates.length === 0) {
    return null;
  }

  const bestRate = compatibleRates.reduce((lowest, current) =>
    current.priceCents < lowest.priceCents ? current : lowest
  );

  return {
    rateId: bestRate.id,
    rateName: bestRate.name,
    nightlyPriceCents: bestRate.priceCents,
    totalPriceCents: bestRate.priceCents * nights,
    currency: bestRate.currency,
    nights,
    refundable: bestRate.refundable,
    breakfastIncluded: bestRate.breakfastIncluded,
  };
}
