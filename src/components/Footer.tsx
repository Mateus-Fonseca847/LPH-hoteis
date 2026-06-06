"use client";

import { FormEvent, useState } from "react";

type SubscriberResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function Footer() {
  const [email, setEmail] = useState("");
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedEmail = email.trim().toLowerCase();

    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      setStatus("error");
      setMessage("Informe um e-mail válido.");
      return;
    }

    if (!consentAccepted) {
      setStatus("error");
      setMessage("É necessário aceitar o recebimento de comunicações promocionais.");
      return;
    }

    setIsSubmitting(true);
    setStatus("idle");
    setMessage("");

    try {
      const response = await fetch("/api/marketing/subscribers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: normalizedEmail,
          consentAccepted,
        }),
      });
      const payload = (await response.json().catch(() => null)) as SubscriberResponse | null;

      if (!response.ok || !payload?.ok) {
        setStatus("error");
        setMessage(payload?.error ?? "Não foi possível realizar o cadastro. Tente novamente.");
        return;
      }

      setStatus("success");
      setMessage(payload.message ?? "Cadastro realizado. Você poderá receber promoções da LPH.");
      setEmail("");
      setConsentAccepted(false);
    } catch {
      setStatus("error");
      setMessage("Não foi possível realizar o cadastro. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <footer id="footer" className="site-footer reveal">
      <div className="footer-top">
        <nav className="footer-links" aria-label="Links do rodapé">
          <a href="#top">Início</a>
          <a href="#journey">Sobre</a>
          <a href="#destinations">Destinos</a>
          <a href="#footer">Contato</a>
        </nav>

        <form className="footer-form" onSubmit={handleSubmit} noValidate>
          <div className="footer-form__row">
            <label className="sr-only" htmlFor="footer-promo-email">
              Endereço de e-mail
            </label>
            <input
              id="footer-promo-email"
              className="footer-form__email"
              type="email"
              placeholder="Seu e-mail"
              autoComplete="email"
              value={email}
              disabled={isSubmitting}
              aria-describedby="footer-promo-consent footer-promo-status"
              onChange={(event) => setEmail(event.target.value)}
            />
            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Enviando..." : "Receber promoções!"}
            </button>
          </div>

          <label id="footer-promo-consent" className="footer-form__consent">
            <input
              type="checkbox"
              checked={consentAccepted}
              disabled={isSubmitting}
              onChange={(event) => setConsentAccepted(event.target.checked)}
            />
            <span>Ao se cadastrar, você aceita receber comunicações promocionais da LPH.</span>
          </label>

          <p
            id="footer-promo-status"
            className={`footer-form__status footer-form__status--${status}`}
            role={status === "error" ? "alert" : "status"}
            aria-live="polite"
          >
            {message}
          </p>
        </form>
      </div>
    </footer>
  );
}
