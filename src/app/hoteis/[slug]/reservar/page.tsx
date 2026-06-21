import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BookingFlow } from "@/components/BookingFlow";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { IconBackLink } from "@/components/IconBackLink";
import { getHotelPageData } from "@/lib/hotel-data";
import { expirePendingReservations } from "@/lib/reservation-expiration";
import {
  DEFAULT_SOCIAL_IMAGE_ALT,
  DEFAULT_SOCIAL_IMAGE_PATH,
  SITE_NAME,
} from "@/lib/site-metadata";

export const dynamic = "force-dynamic";

type HotelBookingPageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams?: Promise<{
    quarto?: string;
  }>;
};

export async function generateMetadata({ params }: HotelBookingPageProps): Promise<Metadata> {
  const { slug } = await params;
  const hotel = await getHotelPageData(slug);

  if (!hotel) {
    return {
      title: "Hospedagem não encontrada",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const title = `Consultar disponibilidade em ${hotel.name}`;
  const description = `Consulte datas, quartos e envie sua solicitação de reserva para ${hotel.name}, ${hotel.city}, ${hotel.state}. O pagamento será finalizado diretamente com o hotel.`;
  const image = hotel.coverImageUrl?.trim() || DEFAULT_SOCIAL_IMAGE_PATH;
  const imageAlt = hotel.coverImageUrl?.trim()
    ? `Vista de ${hotel.name} em ${hotel.city}, ${hotel.state}`
    : DEFAULT_SOCIAL_IMAGE_ALT;
  const url = `/hoteis/${hotel.slug}/reservar`;

  return {
    title,
    description,
    alternates: {
      canonical: url,
    },
    robots: {
      index: false,
      follow: true,
    },
    openGraph: {
      type: "website",
      locale: "pt_BR",
      siteName: SITE_NAME,
      title: `${title} | ${SITE_NAME}`,
      description,
      url,
      images: [{ url: image, width: 1200, height: 630, alt: imageAlt }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | ${SITE_NAME}`,
      description,
      images: [image],
    },
  };
}

export default async function HotelBookingPage({ params, searchParams }: HotelBookingPageProps) {
  const { slug } = await params;
  const query = searchParams ? await searchParams : {};
  await expirePendingReservations();
  const hotel = await getHotelPageData(slug);

  if (!hotel) {
    notFound();
  }

  const availabilityRooms = hotel.rooms.map((room) => ({
    id: room.id,
    name: room.name,
    description: room.description,
    imageUrl: room.imageUrl,
    images: room.images,
    capacity: room.capacity,
    units: room.units,
    capacityAdults: room.capacityAdults,
    capacityChildren: room.capacityChildren,
    beds: room.beds,
    sizeM2: room.sizeM2,
    size: room.size,
    amenities: room.amenities,
    lowestActiveRateCents: room.lowestActiveRateCents,
    publicAvailabilityStatus: room.publicAvailabilityStatus,
    availability: room.availability,
    rates: room.rates,
  }));

  return (
    <div className="page-shell">
      <Header />

      <main className="booking-page">
        <section className="section booking-page-hero reveal is-visible">
          <div className="hotel-topbar">
            <IconBackLink href={`/hoteis/${hotel.slug}`} ariaLabel="Voltar ao hotel" />
          </div>

          <div className="booking-page-heading">
            <h1>Consultar disponibilidade</h1>
            <p>
              Escolha datas, viajantes e quarto para enviar sua solicitação de reserva no{" "}
              {hotel.name}. O pagamento será finalizado diretamente com a equipe do hotel.
            </p>
          </div>
        </section>

        <section className="section booking-page-flow reveal is-visible">
          <BookingFlow
            hotelSlug={hotel.slug}
            hotelId={hotel.id}
            hotelName={hotel.name}
            roomName={query.quarto}
            rooms={availabilityRooms}
          />
        </section>
      </main>

      <Footer />
    </div>
  );
}
