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
          sizes="100vw"
        />

        <div className="hero-copy">
          <p className="hero-title glitch" data-text="Explore o Brasil conosco!">
            Explore o Brasil conosco!
          </p>

          <div className="hero-cta">
            <a className="button-primary" href="#destinations">
              Saiba mais!
            </a>
          </div>
        </div>

        <article className="overlay-card destination-card reveal">
          <h2>Conheça nossa curadoria de destinos inesquecíveis para viajar pelo Brasil.</h2>

          <div className="card-cta-row">
            <button className="card-cta-button" type="button">
              Começar agora!
            </button>
          </div>
        </article>
      </div>
    </section>
  );
}
