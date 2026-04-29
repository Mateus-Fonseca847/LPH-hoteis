"use client";

import { useState } from "react";

import { AvailabilitySearchModal } from "@/components/AvailabilitySearchModal";
import type { AvailabilityResultRoom } from "@/lib/availability-results";

type HotelAvailabilityModalTriggerProps = {
  className: string;
  hotelName: string;
  hotelEmail: string;
  hotelWhatsapp: string;
  roomName?: string;
  rooms: AvailabilityResultRoom[];
};

export function HotelAvailabilityModalTrigger({
  className,
  hotelName,
  hotelEmail,
  hotelWhatsapp,
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
          hotelName={hotelName}
          hotelEmail={hotelEmail}
          hotelWhatsapp={hotelWhatsapp}
          roomName={roomName}
          rooms={rooms}
          onClose={() => setIsOpen(false)}
        />
      ) : null}
    </>
  );
}
