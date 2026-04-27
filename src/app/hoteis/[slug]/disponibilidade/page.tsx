import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { getHotelPageData } from "@/lib/hotel-data";
import {
  formatPriceInBRL,
  getRoomStayAvailabilityStatus,
  getRoomStayPriceEstimate,
} from "@/lib/stay-query";

import { AvailabilitySearchForm } from "./AvailabilitySearchForm";

export const dynamic = "force-dynamic";

type HotelAvailabilityPageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type AvailabilityRoom = NonNullable<Awaited<ReturnType<typeof getHotelPageData>>>["rooms"][number];

function getSearchParam(searchParams: Record<string, string | string[] | undefined>, key: string) {
  const value = searchParams[key];

  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function getPositiveNumber(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getNonNegativeNumber(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10);

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function formatDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatRoomCapacity(room: AvailabilityRoom) {
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

  return `A partir de ${formatPriceInBRL(priceCents)}`;
}

function getRoomAvailabilityLabel(status: "available" | "unavailable" | "unknown") {
  if (status === "available") {
    return "Disponível";
  }

  if (status === "unavailable") {
    return "Indisponível";
  }

  return "Consultar disponibilidade";
}

function resolveRoomAvailabilityStatus(
  room: AvailabilityRoom,
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

function getAvailabilitySortOrder(status: "available" | "unavailable" | "unknown") {
  if (status === "available") {
    return 0;
  }

  if (status === "unknown") {
    return 1;
  }

  return 2;
}

function buildStayRequestHref(
  hotelSlug: string,
  roomId: string,
  checkIn: string,
  checkOut: string,
  adults: number,
  children: number
) {
  const params = new URLSearchParams({
    checkIn,
    checkOut,
    adults: String(adults),
    children: String(children),
    room: roomId,
  });

  return `/hoteis/${hotelSlug}/disponibilidade?${params.toString()}#solicitacao-reserva`;
}

function buildWhatsAppHref(
  phone: string,
  hotelName: string,
  roomName: string,
  checkIn: string,
  checkOut: string,
  adults: number,
  children: number
) {
  const digits = phone.replace(/\D/g, "");

  if (!digits) {
    return null;
  }

  const text =
    `Olá! Gostaria de consultar disponibilidade no ${hotelName}` +
    ` para ${roomName}, de ${checkIn} até ${checkOut},` +
    ` para ${adults} ${adults === 1 ? "adulto" : "adultos"}` +
    (children > 0 ? ` e ${children} ${children === 1 ? "criança" : "crianças"}.` : ".");

  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export default async function HotelAvailabilityPage({
  params,
  searchParams,
}: HotelAvailabilityPageProps) {
  const { slug } = await params;
  const hotel = await getHotelPageData(slug);

  if (!hotel) {
    notFound();
  }

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const defaultCheckIn = formatDateInput(today);
  const defaultCheckOut = formatDateInput(tomorrow);

  const checkIn = getSearchParam(resolvedSearchParams, "checkIn") || defaultCheckIn;
  const checkOut = getSearchParam(resolvedSearchParams, "checkOut") || defaultCheckOut;
  const adults = getPositiveNumber(getSearchParam(resolvedSearchParams, "adults"), 2);
  const children = getNonNegativeNumber(getSearchParam(resolvedSearchParams, "children"), 0);
  const selectedRoomId = getSearchParam(resolvedSearchParams, "room");
  const hasQuery =
    Boolean(getSearchParam(resolvedSearchParams, "checkIn")) ||
    Boolean(getSearchParam(resolvedSearchParams, "checkOut")) ||
    Boolean(getSearchParam(resolvedSearchParams, "adults")) ||
    Boolean(getSearchParam(resolvedSearchParams, "children"));
  const hasValidStayQuery = hasQuery && checkIn && checkOut;

  const roomResults = hotel.rooms
    .map((room) => {
      const availabilityStatus = hasValidStayQuery
        ? resolveRoomAvailabilityStatus(room, checkIn, checkOut, adults, children)
        : room.publicAvailabilityStatus;
      const priceEstimate = hasValidStayQuery
        ? getRoomStayPriceEstimate(room, checkIn, checkOut, adults, children)
        : null;
      const whatsappHref = buildWhatsAppHref(
        hotel.whatsapp,
        hotel.name,
        room.name,
        checkIn,
        checkOut,
        adults,
        children
      );

      return {
        room,
        availabilityStatus,
        priceEstimate,
        whatsappHref,
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

  const hasAvailableOptions = roomResults.some((item) => item.availabilityStatus === "available");
  const hasUnknownOptions = roomResults.some((item) => item.availabilityStatus === "unknown");
  const bestPriceRoomId = roomResults
    .filter((item) => item.availabilityStatus === "available" && item.priceEstimate)
    .reduce<string | null>((lowestId, current, index, items) => {
      if (index === 0) {
        return current.room.id;
      }

      const lowestItem = items.find((item) => item.room.id === lowestId);

      if (!lowestItem?.priceEstimate || !current.priceEstimate) {
        return lowestId;
      }

      return current.priceEstimate.totalPriceCents < lowestItem.priceEstimate.totalPriceCents
        ? current.room.id
        : lowestId;
    }, null);
  const selectedRoom = roomResults.find((item) => item.room.id === selectedRoomId) ?? null;
  const contactWhatsAppHref = buildWhatsAppHref(
    hotel.whatsapp,
    hotel.name,
    selectedRoom?.room.name ?? "hospedagem",
    checkIn,
    checkOut,
    adults,
    children
  );

  return (
    <div className="page-shell">
      <Header />

      <main className="hotel-page hotel-page--enter hotel-availability-page">
        <section className="section hotel-hero-section reveal is-visible">
          <div className="hotel-topbar">
            <Link href={`/hoteis/${hotel.slug}`} className="hotel-page-back">
              Voltar à página do hotel
            </Link>
          </div>

          <div className="hotel-availability-hero">
            <div className="hotel-availability-copy">
              <span className="hotel-page-eyebrow">Consulta de disponibilidade</span>
              <h1>{hotel.name}</h1>
              <p className="hotel-lead">{hotel.shortDescription}</p>
              <div className="hotel-quick-info">
                <div className="hotel-info-card">
                  <span>Destino</span>
                  <strong>
                    {hotel.city}, {hotel.state}
                  </strong>
                </div>
              </div>
            </div>

            <article className="hotel-content-card hotel-availability-form-card">
              <div className="section-heading hotel-section-heading">
                <h2>Informe sua estadia</h2>
              </div>

              <AvailabilitySearchForm
                hotelSlug={hotel.slug}
                defaultCheckIn={checkIn}
                defaultCheckOut={checkOut}
                defaultAdults={adults}
                defaultChildren={children}
                minCheckIn={defaultCheckIn}
              />
            </article>
          </div>
        </section>

        <section className="section reveal is-visible">
          <article className="hotel-content-card hotel-availability-results">
            <div className="section-heading hotel-section-heading">
              <h2>Resultados da consulta</h2>
            </div>

            {hasQuery ? (
              <div className="hotel-availability-results-body">
                <div className="hotel-availability-result-card">
                  <strong>Sua consulta inicial foi registrada.</strong>
                  <p>
                    {hotel.name} em {hotel.city}, {hotel.state} para {adults}{" "}
                    {adults === 1 ? "adulto" : "adultos"}
                    {children > 0
                      ? ` e ${children} ${children === 1 ? "criança" : "crianças"}`
                      : ""}
                    .
                  </p>
                  <p>
                    Período solicitado: <strong>{checkIn}</strong> até <strong>{checkOut}</strong>.
                  </p>
                </div>

                {hasAvailableOptions ? (
                  <div className="hotel-availability-results-intro">
                    <strong>Encontramos opções para sua viagem</strong>
                  </div>
                ) : null}

                {roomResults.length ? (
                  hasAvailableOptions || hasUnknownOptions || !hasValidStayQuery ? (
                    <div className="hotel-rooms-grid hotel-availability-rooms-grid">
                      {roomResults.map(
                        ({ room, availabilityStatus, priceEstimate, whatsappHref }) => {
                          const isBestPrice =
                            availabilityStatus === "available" && bestPriceRoomId === room.id;

                          return (
                            <article key={room.id} className="hotel-room-card">
                              <div className="hotel-room-media">
                                <Image
                                  src={room.imageUrl}
                                  alt={`Quarto ${room.name}`}
                                  fill
                                  sizes="(max-width: 900px) 100vw, 280px"
                                  unoptimized
                                />
                              </div>
                              <div className="hotel-room-body">
                                <div className="hotel-room-header">
                                  <div className="hotel-room-title-group">
                                    <h3>{room.name}</h3>
                                    {isBestPrice ? (
                                      <span className="hotel-room-highlight">Melhor preço</span>
                                    ) : null}
                                  </div>
                                  <span
                                    className={`hotel-room-badge ${
                                      availabilityStatus === "available"
                                        ? "is-available"
                                        : availabilityStatus === "unavailable"
                                          ? "is-unavailable"
                                          : ""
                                    }`}
                                  >
                                    {getRoomAvailabilityLabel(availabilityStatus)}
                                  </span>
                                </div>
                                <p>{room.description}</p>
                                <div className="hotel-room-meta">
                                  <span>{formatRoomCapacity(room)}</span>
                                  <span>{room.beds}</span>
                                  <span>{room.sizeM2 ? `${room.sizeM2} m²` : room.size}</span>
                                </div>
                                <div className="hotel-room-amenities">
                                  {(room.amenities.length
                                    ? room.amenities
                                    : ["Comodidades sob consulta"]
                                  )
                                    .slice(0, 5)
                                    .map((item) => (
                                      <span
                                        key={`${room.id}-${item}`}
                                        className="hotel-room-amenity-pill"
                                      >
                                        {item}
                                      </span>
                                    ))}
                                </div>
                                <div className="hotel-room-footer">
                                  <div>
                                    <strong>
                                      {priceEstimate
                                        ? `${formatPriceInBRL(priceEstimate.nightlyPriceCents)} / noite`
                                        : formatRoomStartingPrice(room.lowestActiveRateCents)}
                                    </strong>
                                    <p className="hotel-room-status">
                                      {getRoomAvailabilityLabel(availabilityStatus)}
                                    </p>
                                    <p className="hotel-room-pricing-note">
                                      {priceEstimate
                                        ? `Total estimado para ${priceEstimate.nights} ${
                                            priceEstimate.nights === 1 ? "noite" : "noites"
                                          }: ${formatPriceInBRL(priceEstimate.totalPriceCents)}`
                                        : "Consultar valores para este período."}
                                    </p>
                                    {priceEstimate ? (
                                      <p className="hotel-room-pricing-note">
                                        {priceEstimate.breakfastIncluded
                                          ? "Café da manhã incluído."
                                          : "Café da manhã sujeito à tarifa escolhida."}{" "}
                                        {priceEstimate.refundable
                                          ? "Tarifa reembolsável."
                                          : "Tarifa não reembolsável."}
                                      </p>
                                    ) : null}
                                    <p className="hotel-room-pricing-note hotel-room-pricing-note--muted">
                                      Impostos e taxas podem variar na confirmação final.
                                    </p>
                                  </div>

                                  {availabilityStatus === "available" ? (
                                    <Link
                                      href={buildStayRequestHref(
                                        hotel.slug,
                                        room.id,
                                        checkIn,
                                        checkOut,
                                        adults,
                                        children
                                      )}
                                      className="hotel-room-cta"
                                    >
                                      Solicitar reserva
                                    </Link>
                                  ) : availabilityStatus === "unknown" ? (
                                    whatsappHref ? (
                                      <a
                                        href={whatsappHref}
                                        className="hotel-room-cta"
                                        target="_blank"
                                        rel="noreferrer"
                                      >
                                        Consultar pelo WhatsApp
                                      </a>
                                    ) : (
                                      <span className="hotel-room-cta hotel-room-cta--disabled">
                                        Consultar pelo WhatsApp
                                      </span>
                                    )
                                  ) : (
                                    <span className="hotel-room-cta hotel-room-cta--disabled">
                                      Indisponível
                                    </span>
                                  )}
                                </div>
                              </div>
                            </article>
                          );
                        }
                      )}
                    </div>
                  ) : (
                    <div className="hotel-empty-state">
                      <strong>Não encontramos quartos disponíveis para esse período.</strong>
                      <p>Tente outras datas.</p>
                    </div>
                  )
                ) : (
                  <div className="hotel-empty-state">
                    <strong>Nenhum quarto ativo disponível no momento</strong>
                    <p>
                      Este hotel ainda não possui categorias públicas ativas para exibir nesta
                      consulta.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="hotel-empty-state">
                <strong>Preencha o formulário para iniciar sua consulta</strong>
                <p>
                  Assim que você informar datas e ocupação, esta área poderá exibir as opções de
                  hospedagem deste hotel.
                </p>
              </div>
            )}
          </article>
        </section>

        {hasQuery ? (
          <section
            id="solicitacao-reserva"
            className="section hotel-cta-panel reveal is-visible hotel-availability-contact-panel"
          >
            <div>
              <span className="hotel-page-eyebrow">Próximo passo</span>
              <h2>
                {selectedRoom
                  ? `Solicitar reserva para ${selectedRoom.room.name}`
                  : "Falar com a equipe"}
              </h2>
              <p className="hotel-description hotel-description--compact">
                {selectedRoom
                  ? `Sua solicitação segue para análise da equipe do ${hotel.name}. As datas escolhidas foram ${checkIn} a ${checkOut}.`
                  : `Se preferir, fale com a equipe do ${hotel.name} para validar disponibilidade e condições da sua estadia.`}
              </p>
            </div>
            <div className="hotel-availability-contact-actions">
              {contactWhatsAppHref ? (
                <a
                  href={contactWhatsAppHref}
                  className="card-cta-button hotel-page-cta"
                  target="_blank"
                  rel="noreferrer"
                >
                  Consultar pelo WhatsApp
                </a>
              ) : null}
              <Link href={`/hoteis/${hotel.slug}`} className="hotel-room-cta">
                Ver página do hotel
              </Link>
            </div>
          </section>
        ) : null}
      </main>

      <Footer />
    </div>
  );
}
