"use client";

import { useEffect, useRef, useState } from "react";

import { experienceDestinations, type ExperienceKey } from "@/data/experience-destinations";

const filters: { key: ExperienceKey; label: string }[] = [
  { key: "esporte", label: "Esporte" },
  { key: "musica", label: "Música" },
  { key: "cinema", label: "Cinema" },
];

export function ExperienceSection() {
  const [activeCategory, setActiveCategory] = useState<ExperienceKey>("esporte");
  const [displayedCategory, setDisplayedCategory] = useState<ExperienceKey>("esporte");
  const [isTransitioning, setIsTransitioning] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleFilterClick = (category: ExperienceKey) => {
    if (isTransitioning || category === activeCategory) return;

    setActiveCategory(category);
    setIsTransitioning(true);

    timeoutRef.current = window.setTimeout(() => {
      setDisplayedCategory(category);
      setIsTransitioning(false);
    }, 180);
  };

  const destinations = experienceDestinations[displayedCategory];

  return (
    <section id="destinations" className="showcase section reveal">
      <div className="showcase-copy">
        <h2>Experiência sem complicação</h2>
        <p>
          Escolha suas preferências e hospede-se perto daquilo que te faz feliz, com uma reserva
          pensada para conforto do check-in ao check-out.
        </p>

        <div className="category-pills">
          {filters.map((filter) => (
            <button
              key={filter.key}
              className={`pill experience-filter ${activeCategory === filter.key ? "active" : ""}`}
              type="button"
              aria-pressed={activeCategory === filter.key}
              data-experience={filter.key}
              onClick={() => handleFilterClick(filter.key)}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      <div className={`showcase-gallery ${isTransitioning ? "is-transitioning" : ""}`}>
        <article
          className="gallery-card large reveal experience-card experience-card--featured"
          data-card-index="0"
        >
          <img src={destinations[0].image} alt={destinations[0].alt} />
          <div className="gallery-caption">
            <strong>{destinations[0].title}</strong>
            <span>{destinations[0].description}</span>
          </div>
        </article>

        <div className="gallery-side">
          {destinations.slice(1).map((destination, index) => (
            <article
              key={`${displayedCategory}-${destination.title}`}
              className="gallery-card reveal experience-card experience-card--small"
              data-card-index={index + 1}
            >
              <img src={destination.image} alt={destination.alt} />
              <div className="gallery-caption">
                <strong>{destination.title}</strong>
                <span>{destination.description}</span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
