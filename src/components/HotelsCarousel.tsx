"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

type PublishedHotelCard = {
  slug: string;
  name: string;
  city: string;
  state: string;
  coverImageUrl: string;
};

type HotelsCarouselProps = {
  hotels: PublishedHotelCard[];
};

export function HotelsCarousel({ hotels }: HotelsCarouselProps) {
  const carouselRef = useRef<HTMLElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const pausedRef = useRef(false);
  const lastTimestampRef = useRef(0);
  const frameRef = useRef<number | null>(null);
  const resumeTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const track = trackRef.current;
    if (!track || hotels.length <= 1) return;

    const pixelsPerSecond = 36;

    const step = (timestamp: number) => {
      if (!lastTimestampRef.current) {
        lastTimestampRef.current = timestamp;
      }

      const delta = timestamp - lastTimestampRef.current;
      lastTimestampRef.current = timestamp;

      if (!pausedRef.current) {
        const halfWidth = track.scrollWidth / 2;
        track.scrollLeft += (pixelsPerSecond * delta) / 1000;

        if (track.scrollLeft >= halfWidth) {
          track.scrollLeft -= halfWidth;
        }
      }

      frameRef.current = window.requestAnimationFrame(step);
    };

    const handleResize = () => {
      track.scrollLeft = 0;
      lastTimestampRef.current = 0;
    };

    window.addEventListener("resize", handleResize);
    frameRef.current = window.requestAnimationFrame(step);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (frameRef.current) {
        window.cancelAnimationFrame(frameRef.current);
      }
      if (resumeTimeoutRef.current) {
        window.clearTimeout(resumeTimeoutRef.current);
      }
    };
  }, [hotels.length]);

  const normalizeLoopPosition = () => {
    const track = trackRef.current;
    if (!track) return;

    const loopWidth = track.scrollWidth / 2;

    if (track.scrollLeft >= loopWidth) {
      track.scrollLeft -= loopWidth;
    }

    if (track.scrollLeft < 0) {
      track.scrollLeft += loopWidth;
    }
  };

  const pauseAutoScrollTemporarily = () => {
    pausedRef.current = true;

    if (resumeTimeoutRef.current) {
      window.clearTimeout(resumeTimeoutRef.current);
    }

    resumeTimeoutRef.current = window.setTimeout(() => {
      pausedRef.current = false;
    }, 1800);
  };

  const moveCarousel = (direction: number) => {
    const track = trackRef.current;
    if (!track) return;

    const firstCard = track.querySelector<HTMLElement>(".hotel-card");
    if (!firstCard) return;

    const trackStyles = window.getComputedStyle(track);
    const gap = Number.parseFloat(trackStyles.gap || "0");
    const step = firstCard.getBoundingClientRect().width + gap;

    pauseAutoScrollTemporarily();
    track.scrollBy({
      left: direction * step,
      behavior: "smooth",
    });

    window.setTimeout(() => {
      normalizeLoopPosition();
    }, 420);
  };

  const allHotels = hotels.length > 1 ? [...hotels, ...hotels] : hotels;

  return (
    <section id="journey" className="journey section reveal">
      <div className="hotels-intro">
        <h2>Conheça nossos hotéis!</h2>
        <p>
          Uma seleção de hospedagens com conforto, localização estratégica e experiências pensadas
          para viagens memoráveis pelo Brasil.
        </p>
      </div>

      {hotels.length === 0 ? (
        <div className="hotel-empty-state">
          <strong>Nenhum hotel disponível no momento.</strong>
          <p>Estamos preparando novas hospedagens publicadas para exibir aqui em breve.</p>
        </div>
      ) : (
        <section
          ref={carouselRef}
          className="hotel-carousel"
          aria-label="Carrossel de hotéis"
          onMouseEnter={() => {
            pausedRef.current = true;
          }}
          onMouseLeave={() => {
            pausedRef.current = false;
          }}
        >
          {hotels.length > 1 ? (
            <button
              className="hotel-carousel-button hotel-carousel-button-prev"
              type="button"
              aria-label="Hotel anterior"
              onClick={() => moveCarousel(-1)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path
                  d="M14.5 5 8 12l6.5 7"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          ) : null}

          <div ref={trackRef} className="hotel-cards-track">
            {allHotels.map((hotel, index) => (
              <Link
                key={`${hotel.slug}-${index}`}
                href={`/hoteis/${hotel.slug}`}
                className="hotel-card hotel-card-link"
                aria-hidden={index >= hotels.length}
                tabIndex={index >= hotels.length ? -1 : 0}
              >
                <img src={hotel.coverImageUrl} alt={hotel.name} />
                <h3>{hotel.name}</h3>
                <p>
                  {hotel.city}, {hotel.state}
                </p>
              </Link>
            ))}
          </div>

          {hotels.length > 1 ? (
            <button
              className="hotel-carousel-button hotel-carousel-button-next"
              type="button"
              aria-label="Próximo hotel"
              onClick={() => moveCarousel(1)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path
                  d="m9.5 5 6.5 7-6.5 7"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          ) : null}
        </section>
      )}
    </section>
  );
}
