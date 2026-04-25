import Link from "next/link";
import { notFound } from "next/navigation";

import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { HotelAmenitiesSection } from "@/components/HotelAmenitiesSection";
import { HotelGallery } from "@/components/HotelGallery";
import { HotelPageActions } from "@/components/HotelPageActions";
import { HotelRegionDetailsSection } from "@/components/HotelRegionDetailsSection";
import { getHotelPageData, getHotelSlugs } from "@/lib/hotel-data";

type HotelPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

type HotelPageRoom = NonNullable<Awaited<ReturnType<typeof getHotelPageData>>>["rooms"][number];

function buildAccessibility(hotel: Awaited<ReturnType<typeof getHotelPageData>>) {
  if (!hotel) {
    return [];
  }

  const matched = hotel.amenities
    .filter((item) => /(acess|elevador|rampa|adaptad|transfer|concierge)/i.test(item.label))
    .map((item) => item.label);

  return matched.length
    ? matched
    : [
        "Equipe disponível para orientar necessidades específicas antes da chegada.",
        "Solicitações de acessibilidade podem ser alinhadas pelo WhatsApp do hotel.",
      ];
}

function buildFaq(hotel: Awaited<ReturnType<typeof getHotelPageData>>) {
  if (!hotel) {
    return [];
  }

  const cancelPolicy =
    hotel.policies.find(
      (policy) => /cancel/i.test(policy.title) || /cancel/i.test(policy.description)
    ) ?? hotel.policies[0];

  return [
    {
      question: "Quais são os horários da hospedagem?",
      answer: `O check-in acontece a partir de ${hotel.checkInTime} e o check-out vai até ${hotel.checkOutTime}.`,
    },
    {
      question: "Como funciona a política principal da reserva?",
      answer: cancelPolicy
        ? `${cancelPolicy.title}: ${cancelPolicy.description}`
        : "As condições da reserva são informadas no momento da consulta de disponibilidade.",
    },
    {
      question: "Como falar com a equipe do hotel?",
      answer: `Você pode entrar em contato pelo telefone ${hotel.phone}, pelo e-mail ${hotel.email} ou pelo WhatsApp ${hotel.whatsapp}.`,
    },
  ];
}

function findPolicyText(
  hotel: Awaited<ReturnType<typeof getHotelPageData>>,
  patterns: RegExp[],
  fallback: string
) {
  if (!hotel) {
    return fallback;
  }

  const matched = hotel.policies.find((policy) =>
    patterns.some((pattern) => pattern.test(policy.title) || pattern.test(policy.description))
  );

  return matched ? `${matched.title}: ${matched.description}` : fallback;
}

function buildPolicySections(hotel: Awaited<ReturnType<typeof getHotelPageData>>) {
  if (!hotel) {
    return [];
  }

  return [
    {
      title: "Políticas da propriedade",
      description: hotel.policies[0]
        ? `${hotel.policies[0].title}: ${hotel.policies[0].description}`
        : "As condições gerais da hospedagem são apresentadas durante a consulta de disponibilidade.",
    },
    {
      title: "Check-in e check-out",
      description: `Check-in a partir de ${hotel.checkInTime} e check-out até ${hotel.checkOutTime}. Alterações antecipadas dependem da disponibilidade do dia.`,
    },
    {
      title: "Crianças e camas extras",
      description: findPolicyText(
        hotel,
        [/crianc/i, /famil/i, /extra/i, /berco/i],
        "Configurações para crianças e necessidades extras podem ser alinhadas com a equipe antes da chegada."
      ),
    },
    {
      title: "Animais de estimação",
      description: findPolicyText(
        hotel,
        [/pet/i, /animai/i],
        "A aceitação de animais depende da categoria reservada e de confirmação prévia com a equipe."
      ),
    },
    {
      title: "Internet",
      description: hotel.amenities.some((item) => /wi-?fi/i.test(item.label))
        ? "A propriedade oferece internet sem fio nas áreas comuns e acomodações compatíveis com o perfil do hotel."
        : "A disponibilidade de internet pode variar conforme a categoria e deve ser confirmada na consulta.",
    },
    {
      title: "Estacionamento",
      description: findPolicyText(
        hotel,
        [/estacion/i, /garag/i, /valet/i],
        "As condições de estacionamento são informadas na confirmação da reserva, conforme a operação local."
      ),
    },
    {
      title: "Acessibilidade",
      description: buildAccessibility(hotel).join(" "),
    },
    {
      title: "Outras informações",
      description:
        hotel.policies.length > 1
          ? hotel.policies
              .slice(1, 3)
              .map((policy) => `${policy.title}: ${policy.description}`)
              .join(" ")
          : "A equipe pode orientar detalhes operacionais, horários e serviços complementares durante a consulta.",
    },
  ];
}

export async function generateStaticParams() {
  const slugs = await getHotelSlugs();

  return slugs.map((slug) => ({
    slug,
  }));
}

function formatRoomCapacity(room: HotelPageRoom) {
  const parts = [`${room.capacityAdults} adulto${room.capacityAdults > 1 ? "s" : ""}`];

  if (room.capacityChildren > 0) {
    parts.push(`${room.capacityChildren} criança${room.capacityChildren > 1 ? "s" : ""}`);
  }

  return parts.join(" + ");
}

function formatRoomStartingPrice(priceCents: number | null) {
  if (priceCents === null) {
    return "Consultar valores";
  }

  return `A partir de ${new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(priceCents / 100)}`;
}

function getRoomAvailabilityLabel(room: HotelPageRoom) {
  if (room.publicAvailabilityStatus === "available") {
    return "Disponível para consulta";
  }

  if (room.publicAvailabilityStatus === "unavailable") {
    return "Indisponível no momento";
  }

  return "Consultar disponibilidade";
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
  const accessibility = buildAccessibility(hotel);
  const faq = buildFaq(hotel);
  const policySections = buildPolicySections(hotel);

  return (
    <div className="page-shell">
      <Header />

      <main className="hotel-page hotel-page--enter">
        <section className="section hotel-hero-section reveal is-visible">
          <div className="hotel-topbar">
            <Link href="/#journey" className="hotel-page-back">
              Voltar à lista de hotéis
            </Link>
            <HotelPageActions hotelName={hotel.name} slug={hotel.slug} />
          </div>

          <div className="hotel-hero-layout">
            <div className="hotel-hero-copy">
              <span className="hotel-page-eyebrow">
                {hotel.city}, {hotel.state}
              </span>
              <h1>{hotel.name}</h1>
              <p className="hotel-lead">{hotel.shortDescription}</p>
              <p className="hotel-description">{hotel.fullDescription}</p>

              <div className="hotel-rating-strip">
                <div className="hotel-rating-stars" aria-label="Estrutura visual de avaliação">
                  <span>★</span>
                  <span>★</span>
                  <span>★</span>
                  <span>★</span>
                  <span>★</span>
                </div>
                <div className="hotel-rating-copy">
                  <strong>Avaliações em breve</strong>
                  <span>Perfil público recém-atualizado na coleção LPH.</span>
                </div>
              </div>

              <div className="hotel-quick-info">
                <div className="hotel-info-card">
                  <span>Localização</span>
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
              </div>
            </div>

            <div className="hotel-hero-media">
              <img src={hotel.coverImageUrl} alt={hotel.name} />
            </div>
          </div>
        </section>

        <section className="section hotel-gallery-section reveal is-visible">
          <div className="section-heading hotel-section-heading">
            <h2>Galeria de imagens</h2>
          </div>

          <HotelGallery hotelName={hotel.name} images={gallery} />
        </section>

        <section className="section reveal is-visible">
          <article className="hotel-content-card hotel-content-card--dark">
            <div className="section-heading hotel-section-heading">
              <h2>Contato e localização</h2>
            </div>
            <div className="hotel-contact-list">
              <p>
                <span>Cidade</span>
                <strong>
                  {hotel.city}, {hotel.state}
                </strong>
              </p>
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

        <section className="section hotel-local-overview reveal is-visible">
          <div className="hotel-local-overview__main">
            <HotelRegionDetailsSection
              address={hotel.address}
              city={hotel.city}
              state={hotel.state}
              latitude={hotel.latitude?.toString() ?? null}
              longitude={hotel.longitude?.toString() ?? null}
              nearbyPlaces={hotel.nearbyPlaces}
            />
          </div>

          <div className="hotel-local-overview__side">
            <HotelAmenitiesSection amenities={hotel.amenities} />
          </div>
        </section>

        <section className="section reveal is-visible">
          <article className="hotel-content-card">
            <div className="section-heading hotel-section-heading">
              <h2>Acessibilidade</h2>
            </div>
            <div className="hotel-policy-info-list">
              {accessibility.map((item) => (
                <article key={item} className="hotel-policy-info-item">
                  <h3>Suporte durante a estadia</h3>
                  <p>{item}</p>
                </article>
              ))}
            </div>
          </article>
        </section>

        <section className="section hotel-content-grid reveal is-visible">
          <article className="hotel-content-card">
            <div className="section-heading hotel-section-heading">
              <h2>Opções de quarto</h2>
            </div>
            {hotel.rooms.length ? (
              <div className="hotel-rooms-grid">
                {hotel.rooms.map((room) => (
                  <article key={room.id} className="hotel-room-card">
                    <div className="hotel-room-media">
                      <img src={room.imageUrl} alt={`Quarto ${room.name}`} />
                    </div>
                    <div className="hotel-room-body">
                      <div className="hotel-room-header">
                        <h3>{room.name}</h3>
                        <span
                          className={`hotel-room-badge ${
                            room.publicAvailabilityStatus === "available"
                              ? "is-available"
                              : "is-unavailable"
                          }`}
                        >
                          {getRoomAvailabilityLabel(room)}
                        </span>
                      </div>
                      <p>{room.description}</p>
                      <div className="hotel-room-meta">
                        <span>{formatRoomCapacity(room)}</span>
                        <span>{room.beds}</span>
                        <span>{room.sizeM2 ? `${room.sizeM2} m²` : room.size}</span>
                      </div>
                      <div className="hotel-room-footer">
                        <div>
                          <strong>{formatRoomStartingPrice(room.lowestActiveRateCents)}</strong>
                          <p className="hotel-room-status">{getRoomAvailabilityLabel(room)}</p>
                        </div>
                        <button type="button" className="hotel-room-cta">
                          Consultar disponibilidade
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="hotel-empty-state">
                <strong>Quartos disponíveis mediante consulta</strong>
                <p>
                  Fale com a equipe do hotel para conhecer as categorias disponíveis para as suas
                  datas.
                </p>
              </div>
            )}
          </article>

          <article className="hotel-content-card">
            <div className="section-heading hotel-section-heading">
              <h2>Avaliações</h2>
            </div>
            <div className="hotel-empty-state">
              <strong>Sem avaliações públicas por enquanto</strong>
              <p>
                Este perfil já está ativo e novas avaliações poderão aparecer aqui conforme a
                operação evoluir.
              </p>
            </div>
          </article>
        </section>

        <section className="section reveal is-visible">
          <div className="section-heading hotel-section-heading">
            <h2>Taxas e políticas</h2>
          </div>
          {policySections.length ? (
            <div className="hotel-policies-grid hotel-policies-grid--wide">
              {policySections.map((section) => (
                <article key={section.title} className="hotel-policy-card">
                  <h3>{section.title}</h3>
                  <p>{section.description}</p>
                </article>
              ))}
            </div>
          ) : (
            <div className="hotel-empty-state">
              <strong>Políticas em atualização</strong>
              <p>
                As condições da hospedagem serão detalhadas nesta área assim que estiverem
                disponíveis.
              </p>
            </div>
          )}
        </section>

        <section className="section reveal is-visible">
          <div className="section-heading hotel-section-heading">
            <h2>Perguntas frequentes</h2>
          </div>
          <div className="hotel-faq-grid">
            {faq.map((item) => (
              <article key={item.question} className="hotel-faq-card">
                <h3>{item.question}</h3>
                <p>{item.answer}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section hotel-cta-panel reveal is-visible">
          <div>
            <span className="hotel-page-eyebrow">Reserva</span>
            <h2>Pronto para consultar sua estadia?</h2>
            <p className="hotel-description hotel-description--compact">
              Fale com a equipe do {hotel.name} para verificar disponibilidade, categorias e
              condições para as suas datas.
            </p>
          </div>
          <button type="button" className="card-cta-button hotel-page-cta">
            Consultar disponibilidade
          </button>
        </section>
      </main>

      <Footer />
    </div>
  );
}
