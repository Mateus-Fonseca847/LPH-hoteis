import type { Metadata } from "next";

import { BrazilHotelsMap } from "@/components/BrazilHotelsMap";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { IconBackLink } from "@/components/IconBackLink";
import { RevealObserver } from "@/components/RevealObserver";
import { getPublishedMapHotels } from "@/lib/hotel-map";
import {
  DEFAULT_SOCIAL_IMAGE_ALT,
  DEFAULT_SOCIAL_IMAGE_PATH,
  SITE_NAME,
} from "@/lib/site-metadata";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mapa de hotéis | LPH Hotéis",
  description: "Explore hotéis publicados da LPH pelo Brasil em um mapa interativo.",
  alternates: {
    canonical: "/mapa",
  },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: SITE_NAME,
    title: "Mapa de hotéis | LPH Hotéis",
    description: "Explore hotéis publicados da LPH pelo Brasil em um mapa interativo.",
    url: "/mapa",
    images: [
      {
        url: DEFAULT_SOCIAL_IMAGE_PATH,
        width: 1200,
        height: 630,
        alt: DEFAULT_SOCIAL_IMAGE_ALT,
      },
    ],
  },
};

export default async function MapPage() {
  const hotels = await getPublishedMapHotels();

  return (
    <div className="page-shell">
      <RevealObserver />
      <Header />

      <main className="section brazil-map-page">
        <section className="brazil-map-hero">
          <div className="brazil-map-heading">
            <h1>Explore hotéis pelo Brasil</h1>
            <p>
              Navegue pelo mapa, aproxime regiões e clique nos pins azuis para conhecer todos os
              nossos hotéis!
            </p>
          </div>
        </section>

        {hotels.length > 0 ? (
          <BrazilHotelsMap hotels={hotels} />
        ) : (
          <div className="hotel-empty-state brazil-map-empty-state">
            <strong>Nenhum hotel publicado com localização suficiente.</strong>
            <p>
              Assim que hotéis aprovados tiverem latitude e longitude cadastradas, eles aparecerão
              neste mapa.
            </p>
            <IconBackLink href="/" ariaLabel="Voltar à home" />
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
