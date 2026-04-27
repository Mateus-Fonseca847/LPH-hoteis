const people = [
  {
    name: "Mateus Fonseca",
    location: "Petrópolis, RJ",
  },
  {
    name: "Diogo Fonseca",
    location: "São Paulo, SP",
  },
];

function DefaultAvatar() {
  return (
    <svg className="person-avatar" viewBox="0 0 120 120" aria-label="Avatar padrão de cliente">
      <rect width="120" height="120" rx="60" fill="#e9e5dc" />
      <circle cx="60" cy="45" r="22" fill="#706d64" />
      <path d="M26 100c6-19 22-29 34-29s28 10 34 29" fill="#706d64" />
    </svg>
  );
}

export function TestimonialsSection() {
  return (
    <section className="testimonials section reveal">
      <div className="section-heading">
        <h2>O que nossos clientes dizem</h2>
      </div>

      <div className="testimonial-layout">
        <article className="person-card reveal">
          <DefaultAvatar />
          <div>
            <strong>{people[0].name}</strong>
            <span>{people[0].location}</span>
          </div>
        </article>

        <article className="quote-card reveal">
          <p>
            &quot;A LPH transformou nossa viagem em uma sequência leve de momentos inesquecíveis. Os
            destinos pareceram escolhidos com cuidado, conforto e charme.&quot;
          </p>
        </article>

        <article className="person-card reveal">
          <DefaultAvatar />
          <div>
            <strong>{people[1].name}</strong>
            <span>{people[1].location}</span>
          </div>
        </article>
      </div>
    </section>
  );
}
