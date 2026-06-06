"use client";

import { useMemo, useState } from "react";

import { ImageWithFallback } from "@/components/ImageWithFallback";

type HotelGalleryImage = {
  url: string;
  alt: string;
  position: number;
};

type HotelGalleryProps = {
  hotelName: string;
  images: HotelGalleryImage[];
};

const SECONDARY_VISIBLE_COUNT = 4;

export function HotelGallery({ hotelName, images }: HotelGalleryProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const featuredImage = images[0];
  const secondaryImages = images.slice(1, SECONDARY_VISIBLE_COUNT + 1);
  const extraImages = images.slice(SECONDARY_VISIBLE_COUNT + 1);

  const visibleExtraImages = useMemo(
    () => (isExpanded ? extraImages : []),
    [extraImages, isExpanded]
  );

  if (!featuredImage) {
    return (
      <div className="hotel-gallery-empty" role="status">
        <strong>Galeria em atualização</strong>
        <p>As imagens deste hotel serão exibidas assim que estiverem disponíveis.</p>
      </div>
    );
  }

  return (
    <div className="hotel-gallery-shell">
      <div className="hotel-gallery-grid">
        <article className="hotel-gallery-card hotel-gallery-card--featured">
          <ImageWithFallback
            src={featuredImage.url}
            alt={featuredImage.alt || `Imagem principal de ${hotelName}`}
            fallbackLabel={`Imagem indisponível de ${hotelName}`}
            fill
            sizes="(max-width: 900px) 100vw, 58vw"
            unoptimized
          />
        </article>

        <div className="hotel-gallery-secondary">
          {secondaryImages.map((image, index) => (
            <article
              key={`${image.position}-${index}-${image.url}`}
              className="hotel-gallery-card hotel-gallery-card--secondary"
            >
              <ImageWithFallback
                src={image.url}
                alt={image.alt || `${hotelName} - foto ${index + 2}`}
                fallbackLabel={`Imagem indisponível de ${hotelName}`}
                fill
                sizes="(max-width: 900px) 50vw, 20vw"
                unoptimized
              />
            </article>
          ))}
        </div>
      </div>

      {extraImages.length > 0 ? (
        <div className="hotel-gallery-more">
          <button
            type="button"
            className="hotel-gallery-more-button"
            onClick={() => setIsExpanded((current) => !current)}
          >
            {isExpanded
              ? "Mostrar menos fotos"
              : `Ver mais ${extraImages.length} foto${extraImages.length > 1 ? "s" : ""}`}
          </button>

          {visibleExtraImages.length > 0 ? (
            <div className="hotel-gallery-extra-grid">
              {visibleExtraImages.map((image, index) => (
                <article
                  key={`${image.position}-extra-${index}-${image.url}`}
                  className="hotel-gallery-card hotel-gallery-card--extra"
                >
                  <ImageWithFallback
                    src={image.url}
                    alt={
                      image.alt ||
                      `${hotelName} - foto adicional ${index + SECONDARY_VISIBLE_COUNT + 2}`
                    }
                    fallbackLabel={`Imagem indisponível de ${hotelName}`}
                    fill
                    sizes="(max-width: 900px) 50vw, 28vw"
                    unoptimized
                  />
                </article>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <p className="hotel-gallery-caption">
          Seleção visual do hotel com imagens principais da estadia.
        </p>
      )}
    </div>
  );
}
