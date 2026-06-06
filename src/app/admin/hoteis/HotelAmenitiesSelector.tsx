"use client";

import {
  findAmenityOptionByLabel,
  HOTEL_AMENITY_OPTIONS,
  HotelAmenityIcon,
} from "@/lib/hotel-amenities";

export type LegacyAmenityItem = {
  id: string;
  label: string;
};

type HotelAmenitiesSelectorProps = {
  selectedAmenityIds: Set<string>;
  legacyAmenities?: LegacyAmenityItem[];
  errorMessage?: string;
  onChange: () => void;
};

export function HotelAmenitiesSelector({
  selectedAmenityIds,
  legacyAmenities = [],
  errorMessage,
  onChange,
}: HotelAmenitiesSelectorProps) {
  return (
    <div className="admin-form-field">
      <span>Selecione as comodidades</span>
      <div className="admin-amenities-grid" role="group" aria-label="Comodidades do hotel">
        {HOTEL_AMENITY_OPTIONS.map((amenity) => (
          <label key={amenity.id} className="admin-amenity-card">
            <input
              type="checkbox"
              name="amenities"
              value={amenity.label}
              defaultChecked={selectedAmenityIds.has(amenity.id)}
              onChange={onChange}
            />
            <span className="admin-amenity-card__icon">
              <HotelAmenityIcon amenityId={amenity.id} />
            </span>
            <span className="admin-amenity-card__content">
              <strong>{amenity.label}</strong>
              <small>Comodidade do hotel</small>
            </span>
            <span className="admin-amenity-card__check" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="m6 12 4 4 8-8" />
              </svg>
            </span>
          </label>
        ))}
      </div>
      {errorMessage ? <small className="admin-form-error">{errorMessage}</small> : null}
      {legacyAmenities.length ? (
        <div className="admin-legacy-amenities">
          <small>
            Comodidades já cadastradas preservadas automaticamente:{" "}
            {legacyAmenities.map((amenity) => amenity.label).join(", ")}.
          </small>
          {legacyAmenities.map((amenity) => (
            <input key={amenity.id} type="hidden" name="amenities" value={amenity.label} />
          ))}
        </div>
      ) : (
        <small>Escolha as comodidades exibidas no perfil público.</small>
      )}
    </div>
  );
}

export function getSelectedAmenityIds(amenities: LegacyAmenityItem[]) {
  return new Set(
    amenities
      .map((amenity) => findAmenityOptionByLabel(amenity.label)?.id)
      .filter((value): value is string => Boolean(value))
  );
}

export function getLegacyAmenities(amenities: LegacyAmenityItem[]) {
  return amenities.filter((amenity) => !findAmenityOptionByLabel(amenity.label));
}
