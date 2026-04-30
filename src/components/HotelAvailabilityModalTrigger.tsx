"use client";

import { useState } from "react";

import { AvailabilitySearchModal } from "@/components/AvailabilitySearchModal";
import type { AvailabilityResultRoom } from "@/lib/availability-results";

type HotelAvailabilityModalTriggerProps = {
  className: string;
  hotelSlug?: string;
  hotelId: string;
  hotelName: string;
  roomName?: string;
  rooms: AvailabilityResultRoom[];
};

export function HotelAvailabilityModalTrigger({
  className,
  hotelSlug,
  hotelId,
  hotelName,
  roomName,
  rooms,
}: HotelAvailabilityModalTriggerProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={`${className} hotel-availability-trigger`}
        onClick={() => setIsOpen(true)}
      >
        Consultar disponibilidade
      </button>

      {isOpen ? (
        <AvailabilitySearchModal
          hotelSlug={hotelSlug}
          hotelId={hotelId}
          hotelName={hotelName}
          roomName={roomName}
          rooms={rooms}
          onClose={() => setIsOpen(false)}
        />
      ) : null}
    </>
  );
}
