import Link from "next/link";

type HotelAvailabilityModalTriggerProps = {
  className: string;
  hotelSlug: string;
  roomName?: string;
};

export function HotelAvailabilityModalTrigger({
  className,
  hotelSlug,
  roomName,
}: HotelAvailabilityModalTriggerProps) {
  const href = `/hoteis/${hotelSlug}/reservar${roomName ? `?quarto=${encodeURIComponent(roomName)}` : ""}`;

  return (
    <Link className={`${className} hotel-availability-trigger`} href={href}>
      Consultar disponibilidade
    </Link>
  );
}
