"use client";

import { useEffect, useRef } from "react";

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
  {
    name: "Lucas Ferreira",
    initials: "LF",
    location: "Vitória, ES",
    tripType: "Negócios",
    quote:
      "As informações estavam claras e ajudaram a escolher uma hospedagem prática para a rotina da viagem.",
  },
];

function TestimonialAvatar({ testimonial }: { testimonial: Testimonial }) {
  return (
    <span className="testimonial-avatar" aria-hidden="true">
      {testimonial.initials}
    </span>
  );
}

function TestimonialCard({
  testimonial,
  isInteractive = true,
}: {
  testimonial: Testimonial;
  isInteractive?: boolean;
}) {
  return (
    <article className="testimonial-slider-card" tabIndex={isInteractive ? 0 : undefined}>
      <div className="testimonial-card-author">
        <TestimonialAvatar testimonial={testimonial} />
        <div>
          <strong>{testimonial.name}</strong>
          <span>{testimonial.location}</span>
        </div>
      </div>
      <p>&quot;{testimonial.quote}&quot;</p>
      <span className="testimonial-trip-type">{testimonial.tripType}</span>
    </article>
  );
}

export function TestimonialsSection() {
  const trackRef = useRef<HTMLDivElement>(null);
  const groupRef = useRef<HTMLDivElement>(null);
  const targetSpeedRef = useRef(38);

  useEffect(() => {
    const track = trackRef.current;
    const group = groupRef.current;

    if (!track || !group) {
      return;
    }

    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frameId = 0;
    let lastFrame = performance.now();
    let offset = 0;
    let currentSpeed = targetSpeedRef.current;
    let loopWidth = group.getBoundingClientRect().width + 18;

    const updateLoopWidth = () => {
      const gap = Number.parseFloat(getComputedStyle(track).columnGap || "18");
      loopWidth = group.getBoundingClientRect().width + gap;
      offset %= loopWidth;
    };

    const animate = (timestamp: number) => {
      const delta = Math.min(timestamp - lastFrame, 48) / 1000;
      lastFrame = timestamp;
      currentSpeed += (targetSpeedRef.current - currentSpeed) * 0.08;
      offset = (offset + currentSpeed * delta) % loopWidth;
      track.style.transform = `translate3d(${-offset}px, 0, 0)`;
      frameId = window.requestAnimationFrame(animate);
    };

    const start = () => {
      updateLoopWidth();
      lastFrame = performance.now();
      frameId = window.requestAnimationFrame(animate);
    };

    const stop = () => {
      window.cancelAnimationFrame(frameId);
      track.style.transform = "translate3d(0, 0, 0)";
    };

    const handleMotionChange = () => {
      stop();

      if (!reducedMotionQuery.matches) {
        start();
      }
    };

    const resizeObserver = new ResizeObserver(updateLoopWidth);
    resizeObserver.observe(group);
    resizeObserver.observe(track);

    if (!reducedMotionQuery.matches) {
      start();
    }

    reducedMotionQuery.addEventListener("change", handleMotionChange);

    return () => {
      window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      reducedMotionQuery.removeEventListener("change", handleMotionChange);
    };
  }, []);

  return (
    <section
      className="testimonials section reveal"
      aria-roledescription="carrossel"
      aria-label="Depoimentos de clientes"
    >
      <div className="testimonial-header">
        <div className="section-heading">
          <h2>O que nossos clientes dizem</h2>
        </div>
      </div>

      <div
        className="testimonial-slider"
        tabIndex={0}
        aria-label="Lista contínua de depoimentos"
        onMouseEnter={() => {
          targetSpeedRef.current = 8;
        }}
        onMouseLeave={() => {
          targetSpeedRef.current = 38;
        }}
        onFocus={() => {
          targetSpeedRef.current = 8;
        }}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            targetSpeedRef.current = 38;
          }
        }}
      >
        <div className="testimonial-slider-track" ref={trackRef}>
          <div className="testimonial-slider-group" ref={groupRef}>
            {testimonials.map((testimonial) => (
              <TestimonialCard
                key={`${testimonial.initials}-${testimonial.location}`}
                testimonial={testimonial}
              />
            ))}
          </div>
          <div className="testimonial-slider-group" aria-hidden="true">
            {testimonials.map((testimonial) => (
              <TestimonialCard
                key={`duplicate-${testimonial.initials}-${testimonial.location}`}
                testimonial={testimonial}
                isInteractive={false}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
