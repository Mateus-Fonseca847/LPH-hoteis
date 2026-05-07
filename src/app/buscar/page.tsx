import Image from "next/image";
import Link from "next/link";

import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { RevealObserver } from "@/components/RevealObserver";
import { normalizeHotelSearchQuery, searchPublishedHotels } from "@/lib/hotel-search";

type SearchPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getSearchParam(searchParams: Record<string, string | string[] | undefined>, key: string) {
  const value = searchParams[key];

  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const query = normalizeHotelSearchQuery(getSearchParam(resolvedSearchParams, "destino"));
  const hotels = query ? await searchPublishedHotels(query) : [];
  const hasQuery = query.length > 0;

  return (
    <div className="page-shell">
      <RevealObserver />
      <Header />

      <main className="section hotel-search-results-page">
        <div className="hotels-intro hotel-search-results-heading">
          <span className="hotel-page-eyebrow">Busca</span>
          <h1>{hasQuery ? `Hotéis para ${query}` : "Busque um destino"}</h1>
          <p>Resultados encontrados por cidade, estado, nome do hotel, endereço ou região.</p>
          <Link href="/" className="outline-round hotel-search-home-link">
            Voltar à home
          </Link>
        </div>

        {!hasQuery ? (
          <div className="hotel-empty-state hotel-search-empty-state">
            <strong>Informe um destino para encontrar hotéis.</strong>
            <p>
              Use a busca da header para pesquisar por cidade, estado, região, endereço ou nome do
              hotel.
            </p>
          </div>
        ) : null}

        {hasQuery && hotels.length === 0 ? (
          <div className="hotel-empty-state">
            <strong>Nenhum hotel encontrado para esse destino.</strong>
            <p>Tente buscar por cidade, estado, região, endereço ou nome do hotel.</p>
          </div>
        ) : null}

        {hotels.length > 0 ? (
          <div className="hotel-search-results-grid">
            {hotels.map((hotel) => (
              <article key={hotel.slug} className="hotel-card hotel-search-result-card">
                <Image
                  src={hotel.coverImageUrl}
                  alt={hotel.name}
                  width={420}
                  height={260}
                  sizes="(max-width: 820px) 100vw, 33vw"
                  unoptimized
                />
                <h2>{hotel.name}</h2>
                <p>
                  {hotel.city}, {hotel.state}
                </p>
                <span>{hotel.address}</span>
                <Link
                  href={`/hoteis/${hotel.slug}`}
                  className="card-cta-button hotel-search-result-link"
                >
                  Abrir hotel
                </Link>
              </article>
            ))}
          </div>
        ) : null}
      </main>

      <Footer />
    </div>
  );
}
