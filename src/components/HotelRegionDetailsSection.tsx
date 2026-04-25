type HotelRegionDetailsSectionProps = {
  address: string;
  city: string;
  state: string;
  latitude: string | null;
  longitude: string | null;
  nearbyPlaces: Array<{
    name: string;
    type: string;
    distanceText: string;
  }>;
};

function NearbyPlaceIcon({ type }: { type: string }) {
  if (type === "airport") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m3 14 8-2 8-7 2 2-7 8-2 8-2-2 1-6-6 1zM4 4l4 4" />
      </svg>
    );
  }

  if (type === "beach") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 11a5 5 0 0 1 10 0M12 6V3M5 21h14M4 17c1.2 0 1.8-.7 2.4-1.2.6-.5 1.2-.9 2.4-.9s1.8.4 2.4.9c.6.5 1.2 1.2 2.4 1.2s1.8-.7 2.4-1.2c.6-.5 1.2-.9 2.4-.9" />
      </svg>
    );
  }

  if (type === "shopping") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 8h12l-1 11H7L6 8Zm3 0V6a3 3 0 1 1 6 0v2" />
      </svg>
    );
  }

  if (type === "museum") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 9h18M5 9V6l7-3 7 3v3M6 20V9M10 20V9M14 20V9M18 20V9M3 20h18" />
      </svg>
    );
  }

  if (type === "historic_center") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 20h16M6 20V8l6-4 6 4v12M9 12h6M10 16h4" />
      </svg>
    );
  }

  if (type === "restaurant") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 3v8M4 3v4M8 3v4M6 11v10M15 3v18M15 3c2 0 4 2 4 5v2h-4" />
      </svg>
    );
  }

  if (type === "park") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 21v-7M7 14a5 5 0 1 1 10 0M9 10a3 3 0 1 1 6 0M5 21h14" />
      </svg>
    );
  }

  if (type === "convention_center") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 20V7l4-3 4 3v13M12 20V9l4-2 4 2v11M8 11h.01M8 15h.01M16 12h.01M16 16h.01" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 21s6-4.8 6-10a6 6 0 1 0-12 0c0 5.2 6 10 6 10Zm0-8.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
    </svg>
  );
}

export function HotelRegionDetailsSection({
  address,
  city,
  state,
  latitude,
  longitude,
  nearbyPlaces,
}: HotelRegionDetailsSectionProps) {
  const hasAddress = Boolean(address.trim());
  const hasCoordinates = Boolean(latitude && longitude);
  const locationQuery = [address, city, state].filter(Boolean).join(", ");
  const encodedLocation = encodeURIComponent(locationQuery);
  const mapEmbedUrl = `https://www.google.com/maps?q=${encodedLocation}&output=embed`;

  return (
    <article className="hotel-content-card">
      <div className="section-heading hotel-section-heading">
        <h2>Detalhes da região</h2>
      </div>
      <div className="hotel-contact-list">
        <p>
          <span>Endereço</span>
          <strong>{address}</strong>
        </p>
        {hasCoordinates ? (
          <p>
            <span>Coordenadas</span>
            <strong>
              {latitude}, {longitude}
            </strong>
          </p>
        ) : null}
      </div>

      <div
        style={{
          marginTop: "22px",
          paddingTop: "22px",
          borderTop: "1px solid rgba(30, 30, 30, 0.08)",
          display: "grid",
          gap: "14px",
        }}
      >
        <span className="hotel-region-nearby__label">Mapa da localização</span>
        {hasAddress ? (
          <div
            style={{
              overflow: "hidden",
              borderRadius: "22px",
              border: "1px solid rgba(30, 30, 30, 0.08)",
              background: "rgba(6, 41, 79, 0.04)",
              minHeight: "280px",
            }}
          >
            <iframe
              src={mapEmbedUrl}
              title={`Mapa da localização do hotel em ${city}`}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              style={{
                width: "100%",
                height: "280px",
                border: "0",
                display: "block",
              }}
            />
          </div>
        ) : (
          <div className="hotel-empty-state">
            <strong>Localização disponível após a consulta.</strong>
          </div>
        )}
      </div>

      {nearbyPlaces.length ? (
        <div className="hotel-region-nearby">
          <span className="hotel-region-nearby__label">Pontos próximos</span>
          <ul className="hotel-region-nearby__list">
            {nearbyPlaces.map((place) => (
              <li key={`${place.type}-${place.name}`}>
                <span className="hotel-region-nearby__icon">
                  <NearbyPlaceIcon type={place.type} />
                </span>
                <span className="hotel-region-nearby__content">
                  <strong>{place.name}</strong>
                  <small>{place.distanceText}</small>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  );
}
