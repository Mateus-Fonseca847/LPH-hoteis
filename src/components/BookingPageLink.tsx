import Link from "next/link";

type BookingPageLinkProps = {
  className: string;
  hotelSlug: string;
  roomName?: string;
};

export function BookingPageLink({ className, hotelSlug, roomName }: BookingPageLinkProps) {
  const href = `/hoteis/${hotelSlug}/reservar${roomName ? `?quarto=${encodeURIComponent(roomName)}` : ""}`;

  return (
    <Link className={`${className} booking-page-link`} href={href}>
      Consultar disponibilidade
    </Link>
  );
}
