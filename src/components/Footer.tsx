"use client";

export function Footer() {
  return (
    <footer id="footer" className="site-footer reveal">
      <div className="footer-top">
        <nav className="footer-links" aria-label="Links do rodapé">
          <a href="#top">Início</a>
          <a href="#journey">Sobre</a>
          <a href="#destinations">Destinos</a>
          <a href="#footer">Contato</a>
        </nav>

        <form
          className="footer-form"
          onSubmit={(event) => {
            event.preventDefault();
          }}
        >
          <label className="sr-only" htmlFor="email">
            Endereço de e-mail
          </label>
          <input id="email" type="email" placeholder="Seu e-mail" />
          <button type="submit">Receber promoções!</button>
        </form>
      </div>
    </footer>
  );
}
