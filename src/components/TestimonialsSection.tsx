"use client";

import { useEffect, useState } from "react";

type Testimonial = {
  name: string;
  initials: string;
  location: string;
  tripType: string;
  quote: string;
};

const testimonials: Testimonial[] = [
  {
    name: "Mariana Alves",
    initials: "MA",
    location: "Campinas, SP",
    tripType: "Fim de semana",
    quote:
      "A experiência foi tranquila do começo ao fim. Encontramos uma hospedagem confortável e bem localizada.",
  },
  {
    name: "Rafael Moreira",
    initials: "RM",
    location: "Belo Horizonte, MG",
    tripType: "Viagem em casal",
    quote:
      "Gostei da forma como as opções combinavam com o meu estilo de viagem. Foi simples escolher onde ficar.",
  },
  {
    name: "Camila Rocha",
    initials: "CR",
    location: "Curitiba, PR",
    tripType: "Descanso",
    quote:
      "A LPH deixou a busca mais leve. Em poucos minutos encontrei uma estadia com a estrutura que eu queria.",
  },
  {
    name: "André Lima",
    initials: "AL",
    location: "Niterói, RJ",
    tripType: "Roteiro urbano",
    quote:
      "Tudo pareceu pensado para facilitar a viagem. A localização e o conforto fizeram diferença.",
  },
  {
    name: "Beatriz Martins",
    initials: "BM",
    location: "Florianópolis, SC",
    tripType: "Praia",
    quote: "A navegação foi clara e as sugestões ajudaram bastante na escolha do hotel.",
  },
];

function getNextIndex(index: number) {
  return (index + 1) % testimonials.length;
}

function getPreviousIndex(index: number) {
  return (index - 1 + testimonials.length) % testimonials.length;
}

function TestimonialAvatar({ testimonial }: { testimonial: Testimonial }) {
  return (
    <span className="testimonial-avatar" aria-hidden="true">
      {testimonial.initials}
    </span>
  );
}

export function TestimonialsSection() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const activeTestimonial = testimonials[activeIndex];
  const nextTestimonial = testimonials[getNextIndex(activeIndex)];

  const showPrevious = () => {
    setActiveIndex((currentIndex) => getPreviousIndex(currentIndex));
  };

  const showNext = () => {
    setActiveIndex((currentIndex) => getNextIndex(currentIndex));
  };

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (isPaused || prefersReducedMotion) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setActiveIndex((currentIndex) => getNextIndex(currentIndex));
    }, 6000);

    return () => window.clearInterval(intervalId);
  }, [isPaused]);

  return (
    <section
      className="testimonials section reveal"
      aria-roledescription="carrossel"
      aria-label="Depoimentos de clientes"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setIsPaused(false);
        }
      }}
    >
      <div className="testimonial-header">
        <div className="section-heading">
          <h2>O que nossos clientes dizem</h2>
        </div>

        <div className="testimonial-controls" aria-label="Controles do carrossel">
          <button type="button" onClick={showPrevious} aria-label="Comentário anterior">
            <span aria-hidden="true">←</span>
          </button>
          <button type="button" onClick={showNext} aria-label="Próximo comentário">
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>

      <div className="testimonial-carousel">
        <article
          key={activeTestimonial.name}
          className="quote-card testimonial-card-main"
          aria-live="polite"
        >
          <div className="testimonial-card-author">
            <TestimonialAvatar testimonial={activeTestimonial} />
            <div>
              <strong>{activeTestimonial.name}</strong>
              <span>{activeTestimonial.location}</span>
            </div>
          </div>
          <p>&quot;{activeTestimonial.quote}&quot;</p>
          <span className="testimonial-trip-type">{activeTestimonial.tripType}</span>
        </article>

        <article key={nextTestimonial.name} className="testimonial-preview-card" aria-hidden="true">
          <span className="testimonial-preview-label">Próximo comentário</span>
          <p>&quot;{nextTestimonial.quote}&quot;</p>
          <div className="testimonial-card-author">
            <TestimonialAvatar testimonial={nextTestimonial} />
            <div>
              <strong>{nextTestimonial.name}</strong>
              <span>{nextTestimonial.location}</span>
            </div>
          </div>
        </article>
      </div>

      <div className="testimonial-indicators" aria-label="Posição dos comentários">
        {testimonials.map((testimonial, index) => (
          <button
            key={testimonial.name}
            type="button"
            className={index === activeIndex ? "active" : ""}
            onClick={() => setActiveIndex(index)}
            aria-label={`Mostrar comentário ${index + 1} de ${testimonials.length}`}
            aria-current={index === activeIndex ? "true" : undefined}
          />
        ))}
      </div>
    </section>
  );
}
