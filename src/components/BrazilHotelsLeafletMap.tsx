"use client";

import type {
  DivIcon,
  LatLngBoundsExpression,
  Map as LeafletMap,
  Marker as LeafletMarker,
} from "leaflet";
import L from "leaflet";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, Marker, TileLayer } from "react-leaflet";

import { ImageWithFallback } from "@/components/ImageWithFallback";
import type { PublicMapHotel } from "@/lib/hotel-map";

type BrazilHotelsLeafletMapProps = {
  hotels: PublicMapHotel[];
};

const BRAZIL_CENTER: [number, number] = [-14.235, -51.9253];
const DEFAULT_ZOOM = 4;
const MIN_ZOOM = 3;
const MAX_ZOOM = 8;
const SOUTH_AMERICA_BOUNDS: LatLngBoundsExpression = [
  [-35, -76],
  [8.5, -28],
];

function createHotelPinIcon(isSelected: boolean): DivIcon {
  return L.divIcon({
    className: `brazil-map-marker ${isSelected ? "is-selected" : ""}`,
    html: [
      '<span class="brazil-map-marker__pin" aria-hidden="true">',
      '<span class="brazil-map-marker__glow"></span>',
      '<span class="brazil-map-marker__core">',
      '<span class="brazil-map-marker__shine"></span>',
      '<span class="brazil-map-marker__center"></span>',
      "</span>",
      "</span>",
    ].join(""),
    iconSize: [28, 40],
    iconAnchor: [14, 36],
  });
}

type HotelMarkerProps = {
  hotel: PublicMapHotel;
  isSelected: boolean;
  onSelect: () => void;
};

function HotelMarker({ hotel, isSelected, onSelect }: HotelMarkerProps) {
  const markerRef = useRef<LeafletMarker | null>(null);
  const icon = useMemo(() => createHotelPinIcon(isSelected), [isSelected]);

  useEffect(() => {
    const marker = markerRef.current;

    if (!marker) {
      return;
    }

    const element = marker.getElement();

    if (!element) {
      return;
    }

    element.setAttribute("role", "button");
    element.setAttribute("tabindex", "0");
    element.setAttribute("aria-label", `Selecionar ${hotel.name} em ${hotel.city}, ${hotel.state}`);
    element.setAttribute("aria-pressed", String(isSelected));

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }

      event.preventDefault();
      onSelect();
    };

    element.addEventListener("keydown", handleKeyDown);

    return () => {
      element.removeEventListener("keydown", handleKeyDown);
    };
  }, [hotel.city, hotel.name, hotel.state, isSelected, onSelect]);

  return (
    <Marker
      ref={markerRef}
      position={[hotel.latitude, hotel.longitude]}
      icon={icon}
      zIndexOffset={isSelected ? 400 : 0}
      eventHandlers={{
        click: onSelect,
      }}
    />
  );
}

export default function BrazilHotelsLeafletMap({ hotels }: BrazilHotelsLeafletMapProps) {
  const [selectedHotelId, setSelectedHotelId] = useState("");
  const [map, setMap] = useState<LeafletMap | null>(null);

  const selectedHotel = hotels.find((hotel) => hotel.id === selectedHotelId) ?? null;
  const selectedHotelIndex = selectedHotel
    ? hotels.findIndex((hotel) => hotel.id === selectedHotel.id) + 1
    : 0;

  useEffect(() => {
    if (!map || !selectedHotel) {
      return;
    }

    map.flyTo([selectedHotel.latitude, selectedHotel.longitude], Math.max(map.getZoom(), 5), {
      animate: true,
      duration: 0.55,
    });
  }, [map, selectedHotel]);

  const mapBounds = useMemo<LatLngBoundsExpression>(() => {
    if (hotels.length === 1) {
      const hotel = hotels[0];
      return [
        [hotel.latitude - 2, hotel.longitude - 2],
        [hotel.latitude + 2, hotel.longitude + 2],
      ];
    }

    return SOUTH_AMERICA_BOUNDS;
  }, [hotels]);

  return (
    <section className="brazil-map-shell" aria-label="Mapa de hotéis publicados no Brasil">
      <div className="brazil-map-layout">
        <div className="brazil-map-stage">
          <div className="brazil-map-stage-header"></div>

          <div className="brazil-map-viewport">
            <MapContainer
              center={BRAZIL_CENTER}
              zoom={DEFAULT_ZOOM}
              minZoom={MIN_ZOOM}
              maxZoom={MAX_ZOOM}
              maxBounds={SOUTH_AMERICA_BOUNDS}
              maxBoundsViscosity={0.9}
              zoomControl={false}
              scrollWheelZoom
              className="brazil-map-leaflet"
              ref={setMap}
              bounds={mapBounds}
              boundsOptions={{ padding: [24, 24] }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
              />

              {hotels.map((hotel) => (
                <HotelMarker
                  key={hotel.id}
                  hotel={hotel}
                  isSelected={hotel.id === selectedHotel?.id}
                  onSelect={() => setSelectedHotelId(hotel.id)}
                />
              ))}
            </MapContainer>
          </div>

          <div className="brazil-map-legend" aria-label="Legenda do mapa">
            <span className="brazil-map-legend-pin" aria-hidden="true" />
            <p>Unidades publicadas com coordenadas válidas, prontas para navegação no mapa.</p>
          </div>
        </div>

        <aside className="brazil-map-panel" aria-live="polite">
          {selectedHotel ? (
            <>
              <div className="brazil-map-panel-top">
                <span className="brazil-map-panel-badge">Hotel selecionado</span>
                <strong className="brazil-map-panel-count">
                  {selectedHotelIndex}/{hotels.length}
                </strong>
              </div>

              <div className="brazil-map-panel-media">
                <ImageWithFallback
                  src={selectedHotel.coverImageUrl}
                  alt={`Vista de ${selectedHotel.name}`}
                  fallbackLabel={`Imagem indisponível de ${selectedHotel.name}`}
                  width={440}
                  height={260}
                  sizes="(max-width: 900px) 100vw, 360px"
                  unoptimized
                />
              </div>

              <div className="brazil-map-panel-content">
                <span className="brazil-map-panel-location">
                  {selectedHotel.city}, {selectedHotel.state}
                </span>
                <h2>{selectedHotel.name}</h2>
                <p>{selectedHotel.shortDescription}</p>
                <small>{selectedHotel.address}</small>
                <Link
                  href={`/hoteis/${selectedHotel.slug}`}
                  className="card-cta-button brazil-map-panel-cta"
                >
                  Ver hotel
                </Link>
              </div>
            </>
          ) : (
            <div className="hotel-empty-state brazil-map-panel-empty">
              <span className="brazil-map-panel-empty-icon" aria-hidden="true">
                +
              </span>
              <strong>Selecione um hotel no mapa.</strong>
              <p>
                Toque em um pin para destacar a unidade, ver o endereço e abrir a página pública.
              </p>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
