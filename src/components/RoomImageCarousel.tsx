"use client";

import { useMemo, useState } from "react";

import { ImageWithFallback } from "@/components/ImageWithFallback";

export type RoomCarouselImage = {
  id?: string;
  url: string;
  alt?: string | null;
  position?: number | null;
};

type RoomImageCarouselProps = {
  images?: RoomCarouselImage[];
  fallbackImageUrl?: string | null;
  roomName: string;
  fallbackLabel?: string;
  sizes: string;
};

export function getNextRoomImageIndex(
  currentIndex: number,
  totalImages: number,
  direction: -1 | 1
) {
  if (totalImages <= 0) {
    return 0;
  }

  return (currentIndex + direction + totalImages) % totalImages;
}

function getRoomImageAlt(image: RoomCarouselImage, roomName: string) {
  return image.alt?.trim() || `Imagem do quarto ${roomName}`;
}

function getRoomImages(
  images: RoomCarouselImage[] | undefined,
  fallbackImageUrl: string | null | undefined,
  roomName: string
) {
  const normalizedImages = (images ?? [])
    .filter((image) => image.url.trim())
    .sort((first, second) => (first.position ?? 0) - (second.position ?? 0))
    .map((image, index) => ({
      ...image,
      id: image.id ?? `${image.url}-${index}`,
      alt: getRoomImageAlt(image, roomName),
    }));

  if (normalizedImages.length > 0) {
    return normalizedImages;
  }

  const fallbackUrl = fallbackImageUrl?.trim();

  return fallbackUrl
    ? [
        {
          id: `${fallbackUrl}-legacy`,
          url: fallbackUrl,
          alt: `Imagem do quarto ${roomName}`,
          position: 0,
        },
      ]
    : [];
}

export function RoomImageCarousel({
  images,
  fallbackImageUrl,
  roomName,
  fallbackLabel,
  sizes,
}: RoomImageCarouselProps) {
  const carouselImages = useMemo(
    () => getRoomImages(images, fallbackImageUrl, roomName),
    [fallbackImageUrl, images, roomName]
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const currentImage = carouselImages[currentIndex] ?? carouselImages[0] ?? null;
  const hasMultipleImages = carouselImages.length > 1;

  if (!currentImage) {
    return (
      <div className="hotel-image-placeholder" role="img" aria-label={roomName}>
        {roomName}
      </div>
    );
  }

  return (
    <div className="room-image-carousel">
      <ImageWithFallback
        src={currentImage.url}
        alt={currentImage.alt}
        fallbackLabel={fallbackLabel ?? `Imagem indisponível do quarto ${roomName}`}
        fill
        sizes={sizes}
        unoptimized
      />

      {hasMultipleImages ? (
        <>
          <button
            type="button"
            className="room-image-carousel__button room-image-carousel__button--prev"
            aria-label={`Imagem anterior de ${roomName}`}
            onClick={() =>
              setCurrentIndex((index) => getNextRoomImageIndex(index, carouselImages.length, -1))
            }
          >
            <span aria-hidden="true">‹</span>
          </button>
          <button
            type="button"
            className="room-image-carousel__button room-image-carousel__button--next"
            aria-label={`Próxima imagem de ${roomName}`}
            onClick={() =>
              setCurrentIndex((index) => getNextRoomImageIndex(index, carouselImages.length, 1))
            }
          >
            <span aria-hidden="true">›</span>
          </button>
          <span className="room-image-carousel__indicator" aria-live="polite">
            {currentIndex + 1}/{carouselImages.length}
          </span>
        </>
      ) : null}
    </div>
  );
}
