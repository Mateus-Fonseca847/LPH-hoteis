"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";

const tripTypes = ["Lazer", "Família", "Casal", "Negócios", "Aventura"];
const preferenceOptions = ["Praia", "Serra", "Urbano", "Descanso", "Gastronomia", "Eventos"];

type RecommendedHotel = {
  slug: string;
  name: string;
  city: string;
  state: string;
  address: string;
  coverImageUrl: string;
  score: number;
  reason: string;
  estimatedPriceCents: number | null;
};

type RecommendationsResponse = {
  ok?: boolean;
  error?: string;
  recommendations?: RecommendedHotel[];
};

function formatEstimatedPrice(value: number | null) {
  if (!value) {
    return null;
  }

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value / 100);
}

function getCompatibilityLabel(score: number) {
  if (score >= 78) {
    return "Alta compatibilidade";
  }

  if (score >= 48) {
    return "Boa compatibilidade";
  }

  return "Compatível";
}

export function TripPlannerSection() {
  const [destination, setDestination] = useState("");
  const [tripType, setTripType] = useState(tripTypes[0]);
  const [budget, setBudget] = useState("");
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [preferences, setPreferences] = useState<string[]>(["Descanso"]);
  const [error, setError] = useState("");
  const [showSummary, setShowSummary] = useState(false);
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false);
  const [recommendations, setRecommendations] = useState<RecommendedHotel[]>([]);

  const searchHref = useMemo(() => {
    const query = destination.trim();

    return query ? `/buscar?destino=${encodeURIComponent(query)}` : "/buscar";
  }, [destination]);

  function togglePreference(preference: string) {
    setPreferences((current) =>
      current.includes(preference)
        ? current.filter((item) => item !== preference)
        : [...current, preference]
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const safeDestination = destination.trim();

    if (!safeDestination) {
      setError("Informe um destino para montar o perfil da viagem.");
      setShowSummary(false);
      setRecommendations([]);
      return;
    }

    if (adults < 1) {
      setError("Informe pelo menos 1 adulto.");
      setShowSummary(false);
      setRecommendations([]);
      return;
    }

    setError("");
    setShowSummary(false);
    setRecommendations([]);
    setIsLoadingRecommendations(true);

    try {
      const response = await fetch("/api/viagem/recomendacoes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          destination: safeDestination,
          tripType,
          budget,
          adults,
          children,
          startDate,
          endDate,
          preferences,
        }),
      });
      const payload = (await response.json().catch(() => null)) as RecommendationsResponse | null;

      if (!response.ok || !payload?.ok) {
        setError(payload?.error ?? "Não foi possível gerar recomendações agora.");
        return;
      }

      setRecommendations(payload.recommendations ?? []);
      setShowSummary(true);
    } catch {
      setError("Não foi possível gerar recomendações agora.");
    } finally {
      setIsLoadingRecommendations(false);
    }
  }

  return (
    <section id="planeje-sua-viagem" className="section trip-planner-section reveal">
      <div className="trip-planner-copy">
        <span className="hotel-page-eyebrow">Planeje sua viagem</span>
        <h2>Conte o perfil da sua estadia.</h2>
        <p>
          Informe destino, companhia, orçamento e preferências para iniciar uma busca mais alinhada
          ao seu momento de viagem.
        </p>
      </div>

      <form className="trip-planner-form" onSubmit={handleSubmit} noValidate>
        <div className="trip-planner-grid">
          <label className="trip-planner-field trip-planner-field--wide">
            <span>Destino desejado</span>
            <input
              type="text"
              value={destination}
              onChange={(event) => setDestination(event.target.value)}
              placeholder="Ex.: Florianópolis, Serra Gaúcha, São Paulo"
              autoComplete="address-level2"
              aria-describedby={error ? "trip-planner-error" : undefined}
            />
          </label>

          <label className="trip-planner-field">
            <span>Orçamento aproximado</span>
            <select value={budget} onChange={(event) => setBudget(event.target.value)}>
              <option value="">A definir</option>
              <option value="Até R$ 800">Até R$ 800</option>
              <option value="R$ 800 a R$ 1.500">R$ 800 a R$ 1.500</option>
              <option value="R$ 1.500 a R$ 3.000">R$ 1.500 a R$ 3.000</option>
              <option value="Acima de R$ 3.000">Acima de R$ 3.000</option>
            </select>
          </label>

          <fieldset className="trip-planner-choice-group trip-planner-field--wide">
            <legend>Tipo de viagem</legend>
            <div className="trip-planner-options">
              {tripTypes.map((type) => (
                <label key={type} className="trip-planner-chip">
                  <input
                    type="radio"
                    name="tripType"
                    value={type}
                    checked={tripType === type}
                    onChange={() => setTripType(type)}
                  />
                  <span>{type}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <label className="trip-planner-field">
            <span>Adultos</span>
            <input
              type="number"
              min="1"
              max="12"
              value={adults}
              onChange={(event) => setAdults(Number(event.target.value))}
            />
          </label>

          <label className="trip-planner-field">
            <span>Crianças</span>
            <input
              type="number"
              min="0"
              max="12"
              value={children}
              onChange={(event) => setChildren(Number(event.target.value))}
            />
          </label>

          <label className="trip-planner-field">
            <span>Data de ida</span>
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </label>

          <label className="trip-planner-field">
            <span>Data de volta</span>
            <input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </label>

          <fieldset className="trip-planner-choice-group trip-planner-field--wide">
            <legend>Preferências</legend>
            <div className="trip-planner-options">
              {preferenceOptions.map((preference) => (
                <label key={preference} className="trip-planner-chip">
                  <input
                    type="checkbox"
                    checked={preferences.includes(preference)}
                    onChange={() => togglePreference(preference)}
                  />
                  <span>{preference}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        {error ? (
          <p id="trip-planner-error" className="trip-planner-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="trip-planner-actions">
          <button type="submit" className="card-cta-button" disabled={isLoadingRecommendations}>
            {isLoadingRecommendations ? "Recomendando..." : "Montar perfil"}
          </button>
          <Link href={searchHref} className="outline-round">
            Buscar hotéis
          </Link>
        </div>

        {showSummary ? (
          <div className="trip-planner-summary" aria-live="polite">
            <strong>Perfil inicial pronto</strong>
            <span>
              {tripType} em {destination.trim()}, {adults} adulto{adults === 1 ? "" : "s"}
              {children > 0 ? ` e ${children} criança${children === 1 ? "" : "s"}` : ""}.
            </span>
            <small>
              Preferências:{" "}
              {preferences.length > 0 ? preferences.join(", ") : "sem preferência definida"}
              {budget ? ` · Orçamento: ${budget}` : ""}.
            </small>
          </div>
        ) : null}

        {showSummary ? (
          <div className="trip-planner-recommendations" aria-live="polite">
            <div className="trip-planner-recommendations__head">
              <strong>Hotéis recomendados</strong>
              <span>
                {recommendations.length} opção{recommendations.length === 1 ? "" : "ões"}
              </span>
            </div>

            {recommendations.length > 0 ? (
              <div className="trip-planner-recommendations__list">
                {recommendations.map((hotel) => {
                  const estimatedPrice = formatEstimatedPrice(hotel.estimatedPriceCents);

                  return (
                    <article key={hotel.slug} className="trip-planner-recommendation-card">
                      <Image
                        src={hotel.coverImageUrl}
                        alt={hotel.name}
                        width={96}
                        height={72}
                        sizes="96px"
                        unoptimized
                      />
                      <div>
                        <div className="trip-planner-recommendation-card__top">
                          <strong>{hotel.name}</strong>
                          <span>{getCompatibilityLabel(hotel.score)}</span>
                        </div>
                        <small>
                          {hotel.city}, {hotel.state}
                        </small>
                        <p>{hotel.reason}</p>
                        {estimatedPrice ? <em>A partir de {estimatedPrice}</em> : null}
                      </div>
                      <div className="trip-planner-recommendation-actions">
                        <Link
                          href={`/hoteis/${hotel.slug}`}
                          className="trip-planner-recommendation-link"
                        >
                          Ver hotel
                        </Link>
                        <Link
                          href={`/hoteis/${hotel.slug}/reservar`}
                          className="trip-planner-recommendation-link trip-planner-recommendation-link--primary"
                        >
                          Consultar disponibilidade
                        </Link>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <p className="trip-planner-recommendations__empty">
                Não encontramos uma opção ideal, mas você pode ajustar os filtros.
              </p>
            )}
          </div>
        ) : null}
      </form>
    </section>
  );
}
