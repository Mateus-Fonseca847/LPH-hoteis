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

const avatarSrc =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'%3E%3Crect width='120' height='120' rx='60' fill='%23e9e5dc'/%3E%3Ccircle cx='60' cy='45' r='22' fill='%23706d64'/%3E%3Cpath d='M26 100c6-19 22-29 34-29s28 10 34 29' fill='%23706d64'/%3E%3C/svg%3E";

export function TestimonialsSection() {
  return (
    <section className="testimonials section reveal">
      <div className="section-heading">
        <h2>O que nossos clientes dizem</h2>
      </div>

      <div className="testimonial-layout">
        <article className="person-card reveal">
          <img src={avatarSrc} alt="Avatar padrão de cliente" />
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
          <img src={avatarSrc} alt="Avatar padrão de cliente" />
          <div>
            <strong>{people[1].name}</strong>
            <span>{people[1].location}</span>
          </div>
        </article>
      </div>
    </section>
  );
}
