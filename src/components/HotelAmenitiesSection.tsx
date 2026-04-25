type HotelAmenityItem = {
  id: string;
  label: string;
};

type HotelAmenitiesSectionProps = {
  amenities: HotelAmenityItem[];
};

function AmenityIcon({ label }: { label: string }) {
  const normalized = label.toLowerCase();

  if (/piscina|pool|spa aqu/i.test(normalized)) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 15c1.3 0 1.9-.8 2.5-1.4.6-.6 1.2-1.1 2.5-1.1s1.9.5 2.5 1.1c.6.6 1.2 1.4 2.5 1.4s1.9-.8 2.5-1.4c.6-.6 1.2-1.1 2.5-1.1s1.9.5 2.5 1.1c.6.6 1.2 1.4 2.5 1.4M3 19c1.3 0 1.9-.8 2.5-1.4.6-.6 1.2-1.1 2.5-1.1s1.9.5 2.5 1.1c.6.6 1.2 1.4 2.5 1.4s1.9-.8 2.5-1.4c.6-.6 1.2-1.1 2.5-1.1s1.9.5 2.5 1.1c.6.6 1.2 1.4 2.5 1.4" />
      </svg>
    );
  }

  if (/caf[eé]|breakfast|manh/i.test(normalized)) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 8h10v5a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8Zm10 1h2a2.5 2.5 0 0 1 0 5h-2M7 4v2M10 3v3M13 4v2M4 20h12" />
      </svg>
    );
  }

  if (/estacion|parking/i.test(normalized)) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 20V4h6a4 4 0 0 1 0 8H7m0-8v8m0-4h5" />
      </svg>
    );
  }

  if (/wi-?fi|internet/i.test(normalized)) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 9a14.5 14.5 0 0 1 18 0M6 12.5a9.5 9.5 0 0 1 12 0M9.5 16a4.5 4.5 0 0 1 5 0M12 19h.01" />
      </svg>
    );
  }

  if (/24h|recep|concierge|atendimento/i.test(normalized)) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    );
  }

  if (/lounge|sof[aá]|estar/i.test(normalized)) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 13h14v4H5zM7 10a2 2 0 1 1 4 0v3H7v-3Zm6 0a2 2 0 1 1 4 0v3h-4v-3ZM4 20v-3M20 20v-3" />
      </svg>
    );
  }

  if (/academia|gym|halter|fitness/i.test(normalized)) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 10v4M6 8v8M9 9v6M15 9v6M18 8v8M21 10v4M9 12h6" />
      </svg>
    );
  }

  if (/restaurante|talher|jantar|almo/i.test(normalized)) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 3v8M4 3v4M8 3v4M6 11v10M15 3v18M15 3c2 0 4 2 4 5v2h-4" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m5 12 4 4L19 6" />
    </svg>
  );
}

export function HotelAmenitiesSection({ amenities }: HotelAmenitiesSectionProps) {
  return (
    <section className="section reveal is-visible">
      <article className="hotel-content-card">
        <div className="section-heading hotel-section-heading">
          <h2>Comodidades principais</h2>
        </div>
        {amenities.length ? (
          <ul className="hotel-list">
            {amenities.map((amenity) => (
              <li key={amenity.id}>
                <span className="hotel-amenity-icon">
                  <AmenityIcon label={amenity.label} />
                </span>
                <span className="hotel-amenity-label">{amenity.label}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="hotel-empty-state">
            <strong>Comodidades em atualização</strong>
            <p>Os principais serviços da estadia serão exibidos aqui em breve.</p>
          </div>
        )}
      </article>
    </section>
  );
}
