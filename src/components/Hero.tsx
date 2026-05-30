import Image from "next/image";

export function Hero() {
  return (
    <section className="hero section reveal">
      <div className="hero-media">
        <Image
          src="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=80"
          alt="Família aproveitando uma experiência tropical no mar"
          fill
          priority
          quality={82}
          sizes="100vw"
        />

        <div className="hero-copy">
          <h1 className="hero-title">Explore o Brasil conosco!</h1>

          <div className="hero-cta">
            <a className="button-primary" href="#destinations">
              Saiba mais!
            </a>
          </div>
        </div>

        <article className="overlay-card destination-card reveal">
          <h2>Conheça nossa curadoria de destinos inesquecíveis para viajar pelo Brasil.</h2>

          <div className="card-cta-row">
            <a className="card-cta-button" href="#journey">
              Começar agora!
            </a>
          </div>
        </article>
      </div>
    </section>
  );
}
