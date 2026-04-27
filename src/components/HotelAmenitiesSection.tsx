import { HotelAmenityIcon } from "@/lib/hotel-amenities";

type HotelAmenityItem = {
  id: string;
  label: string;
};

type HotelAmenitiesSectionProps = {
  amenities: HotelAmenityItem[];
};

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
                  <HotelAmenityIcon label={amenity.label} />
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
