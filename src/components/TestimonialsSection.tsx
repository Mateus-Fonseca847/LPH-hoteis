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

function TestimonialCard({ testimonial }: { testimonial: Testimonial }) {
  return (
    <article className="testimonial-slider-card">
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

      <div className="testimonial-slider" tabIndex={0} aria-label="Lista contínua de depoimentos">
        <div className="testimonial-slider-track">
          <div className="testimonial-slider-group">
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
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
