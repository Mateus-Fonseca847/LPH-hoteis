import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AvailabilitySearchModal } from "@/components/AvailabilitySearchModal";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { getHotelPageData } from "@/lib/hotel-data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Consultar disponibilidade",
  robots: {
    index: false,
    follow: false,
  },
};

type HotelBookingPageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams?: Promise<{
    quarto?: string;
  }>;
};

export default async function HotelBookingPage({ params, searchParams }: HotelBookingPageProps) {
  const { slug } = await params;
  const query = searchParams ? await searchParams : {};
  const hotel = await getHotelPageData(slug);

  if (!hotel) {
    notFound();
  }

  const availabilityRooms = hotel.rooms.map((room) => ({
    id: room.id,
    name: room.name,
    description: room.description,
    imageUrl: room.imageUrl,
    capacity: room.capacity,
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
            <Link href={`/hoteis/${hotel.slug}`} className="hotel-page-back">
              Voltar ao hotel
            </Link>
          </div>

          <div className="booking-page-heading">
            <span className="hotel-page-eyebrow">
              {hotel.city}, {hotel.state}
            </span>
            <h1>Consultar disponibilidade</h1>
            <p>
              Escolha datas, viajantes e quarto para iniciar a reserva no {hotel.name}. A reserva só
              é confirmada após a aprovação do pagamento.
            </p>
          </div>
        </section>

        <section className="section booking-page-flow reveal is-visible">
          <AvailabilitySearchModal
            variant="page"
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
