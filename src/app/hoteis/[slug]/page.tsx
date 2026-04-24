import Link from "next/link";
import { notFound } from "next/navigation";

import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { getHotelPageData, getHotelSlugs } from "@/lib/hotel-data";

type HotelPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export async function generateStaticParams() {
  const slugs = await getHotelSlugs();

  return slugs.map((slug) => ({
    slug,
  }));
}

export default async function HotelPage({ params }: HotelPageProps) {
  const { slug } = await params;
  const hotel = await getHotelPageData(slug);

  if (!hotel) {
    notFound();
  }

  const gallery = hotel.images.length
    ? hotel.images
    : [{ url: hotel.coverImageUrl, alt: hotel.name, position: 0 }];

  const hasCoordinates = hotel.latitude && hotel.longitude;

  return (
    <div className="page-shell">
      <Header />

      <main className="hotel-page">
        <section className="section hotel-hero-section reveal is-visible">
          <div className="hotel-hero-layout">
            <div className="hotel-hero-copy">
              <span className="hotel-page-eyebrow">
                {hotel.city}, {hotel.state}
              </span>
              <h1>{hotel.name}</h1>
              <p className="hotel-lead">{hotel.shortDescription}</p>
              <p className="hotel-description">{hotel.fullDescription}</p>

              <div className="hotel-quick-info">
                <div className="hotel-info-card">
                  <span>Endereço</span>
                  <strong>{hotel.address}</strong>
                </div>
                <div className="hotel-info-card">
                  <span>Check-in / Check-out</span>
                  <strong>
                    {hotel.checkInTime} / {hotel.checkOutTime}
                  </strong>
                </div>
              </div>

              <div className="hotel-page-actions">
                <button type="button" className="card-cta-button hotel-page-cta">
                  Consultar disponibilidade
                </button>
                <Link href="/#journey" className="hotel-page-back">
                  Voltar aos hotéis
                </Link>
              </div>
            </div>

            <div className="hotel-hero-media">
              <img src={hotel.coverImageUrl} alt={hotel.name} />
            </div>
          </div>
        </section>

        <section className="section hotel-gallery-section reveal is-visible">
          <div className="section-heading hotel-section-heading">
            <h2>Galeria</h2>
          </div>

          <div className="hotel-gallery-grid">
            {gallery.map((image, index) => (
              <article
                key={`${hotel.slug}-gallery-${image.position}-${index}`}
                className={`hotel-gallery-card ${index === 0 ? "hotel-gallery-card--featured" : ""}`}
              >
                <img src={image.url} alt={image.alt || `${hotel.name} - imagem ${index + 1}`} />
              </article>
            ))}
          </div>
        </section>

        <section className="section hotel-content-grid reveal is-visible">
          <article className="hotel-content-card">
            <div className="section-heading hotel-section-heading">
              <h2>Comodidades</h2>
            </div>
            <ul className="hotel-list">
              {hotel.amenities.map((amenity) => (
                <li key={amenity.id}>{amenity.label}</li>
              ))}
            </ul>
          </article>

          <article className="hotel-content-card hotel-content-card--dark">
            <div className="section-heading hotel-section-heading">
              <h2>Contatos</h2>
            </div>
            <div className="hotel-contact-list">
              <p>
                <span>Telefone</span>
                <strong>{hotel.phone}</strong>
              </p>
              <p>
                <span>E-mail</span>
                <strong>{hotel.email}</strong>
              </p>
              <p>
                <span>WhatsApp</span>
                <strong>{hotel.whatsapp}</strong>
              </p>
            </div>
          </article>
        </section>

        <section className="section hotel-content-grid reveal is-visible">
          <article className="hotel-content-card">
            <div className="section-heading hotel-section-heading">
              <h2>Políticas da hospedagem</h2>
            </div>
            <div className="hotel-policies-grid">
              {hotel.policies.map((policy) => (
                <article key={policy.id} className="hotel-policy-card">
                  <h3>{policy.title}</h3>
                  <p>{policy.description}</p>
                </article>
              ))}
            </div>
          </article>

          <article className="hotel-content-card">
            <div className="section-heading hotel-section-heading">
              <h2>Informações da região</h2>
            </div>
            <div className="hotel-contact-list">
              <p>
                <span>Localização</span>
                <strong>
                  {hotel.city}, {hotel.state}
                </strong>
              </p>
              <p>
                <span>Endereço</span>
                <strong>{hotel.address}</strong>
              </p>
              {hasCoordinates ? (
                <p>
                  <span>Coordenadas</span>
                  <strong>
                    {hotel.latitude?.toString()}, {hotel.longitude?.toString()}
                  </strong>
                </p>
              ) : null}
            </div>
          </article>
        </section>
      </main>

      <Footer />
    </div>
  );
}
