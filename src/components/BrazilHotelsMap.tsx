"use client";

import dynamic from "next/dynamic";

import type { PublicMapHotel } from "@/lib/hotel-map";

type BrazilHotelsMapProps = {
  hotels: PublicMapHotel[];
};

const BrazilHotelsLeafletMap = dynamic(() => import("./BrazilHotelsLeafletMap"), {
  ssr: false,
  loading: () => (
    <section className="brazil-map-shell" aria-label="Carregando mapa de hotéis">
      <div className="public-loading-state">
        <div className="public-loading-block public-loading-block--hero" />
      </div>
    </section>
  ),
});

export function BrazilHotelsMap({ hotels }: BrazilHotelsMapProps) {
  return <BrazilHotelsLeafletMap hotels={hotels} />;
}
