import {
  canRoomAccommodateGuests,
  formatPriceInBRL,
  getRoomStayAvailabilityStatus,
  getRoomStayPriceEstimate,
  type RoomStayPriceEstimate,
  type StayAvailabilityStatus,
} from "@/lib/stay-query";

export type AvailabilityResultRoom = {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  capacity: number;
  capacityAdults: number;
  capacityChildren: number;
  beds: string;
  sizeM2: number | null;
  size: string;
  amenities: string[];
  lowestActiveRateCents: number | null;
  publicAvailabilityStatus: StayAvailabilityStatus;
  availability?: Array<{
    date: string;
    availableUnits: number;
    closed: boolean;
  }>;
  rates?: Array<{
    id: string;
    name: string;
    description: string;
    priceCents: number;
    currency: string;
    startDate: string;
    endDate: string;
    minNights: number;
    maxGuests: number;
    refundable: boolean;
    breakfastIncluded: boolean;
  }>;
};

export type AvailabilityRoomResult = {
  room: AvailabilityResultRoom;
  availabilityStatus: StayAvailabilityStatus;
  priceEstimate: RoomStayPriceEstimate | null;
  startingPriceLabel: string;
  availabilityLabel: string;
  capacityLabel: string;
};

function formatRoomCapacity(room: AvailabilityResultRoom) {
  const parts = [`${room.capacityAdults} adulto${room.capacityAdults > 1 ? "s" : ""}`];

  if (room.capacityChildren > 0) {
    parts.push(`${room.capacityChildren} crianca${room.capacityChildren > 1 ? "s" : ""}`);
  }

  return parts.join(" + ");
}

export function formatRoomStartingPrice(priceCents: number | null) {
  if (priceCents === null) {
    return "Consultar valores";
  }

  return `A partir de ${formatPriceInBRL(priceCents)}`;
}

export function getRoomAvailabilityLabel(status: StayAvailabilityStatus) {
  if (status === "available") {
    return "Disponivel";
  }

  if (status === "unavailable") {
    return "Indisponivel";
  }

  return "Consultar disponibilidade";
}

function resolveRoomAvailabilityStatus(
  room: AvailabilityResultRoom,
  checkIn: string,
  checkOut: string,
  adults: number,
  children: number
) {
  try {
    return getRoomStayAvailabilityStatus(room, checkIn, checkOut, adults, children);
  } catch {
    return "unknown" as const;
  }
}

function resolveRoomPriceEstimate(
  room: AvailabilityResultRoom,
  checkIn: string,
  checkOut: string,
  adults: number,
  children: number
) {
  try {
    return getRoomStayPriceEstimate(room, checkIn, checkOut, adults, children);
  } catch {
    return null;
  }
}

function getAvailabilitySortOrder(status: StayAvailabilityStatus) {
  if (status === "available") {
    return 0;
  }

  if (status === "unknown") {
    return 1;
  }

  return 2;
}

export function getCompatibleRoomAvailabilityResults({
  rooms,
  checkIn,
  checkOut,
  adults,
  children,
}: {
  rooms: AvailabilityResultRoom[];
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
}) {
  return rooms
    .filter((room) => {
      try {
        return canRoomAccommodateGuests(room, adults, children);
      } catch {
        return false;
      }
    })
    .map((room) => {
      const availabilityStatus = resolveRoomAvailabilityStatus(
        room,
        checkIn,
        checkOut,
        adults,
        children
      );
      const priceEstimate = resolveRoomPriceEstimate(room, checkIn, checkOut, adults, children);

      return {
        room,
        availabilityStatus,
        priceEstimate,
        startingPriceLabel: formatRoomStartingPrice(room.lowestActiveRateCents),
        availabilityLabel: getRoomAvailabilityLabel(availabilityStatus),
        capacityLabel: formatRoomCapacity(room),
      };
    })
    .sort((left, right) => {
      const statusDiff =
        getAvailabilitySortOrder(left.availabilityStatus) -
        getAvailabilitySortOrder(right.availabilityStatus);

      if (statusDiff !== 0) {
        return statusDiff;
      }

      if (left.priceEstimate && right.priceEstimate) {
        return left.priceEstimate.totalPriceCents - right.priceEstimate.totalPriceCents;
      }

      if (left.priceEstimate) {
        return -1;
      }

      if (right.priceEstimate) {
        return 1;
      }

      return left.room.name.localeCompare(right.room.name, "pt-BR");
    });
}
