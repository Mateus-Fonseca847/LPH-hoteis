"use client";

import { FormEvent, useState } from "react";

type PasswordResetRequestResponse = {
  message?: string;
  error?: string;
};

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/password-reset/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });
      const data = (await response.json()) as PasswordResetRequestResponse;

      if (!response.ok) {
        setError(data.error ?? "Não foi possível solicitar a redefinição de senha.");
        return;
      }

      setMessage(data.message ?? "Se este e-mail estiver cadastrado, enviaremos instruções.");
    } catch {
      setError("Não foi possível solicitar a redefinição de senha.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <div className="auth-field">
        <label htmlFor="email">E-mail</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="Seu email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </div>

      {message ? <p className="auth-help">{message}</p> : null}
      {error ? <p className="auth-error">{error}</p> : null}

      <button className="card-cta-button auth-submit" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Enviando..." : "Enviar instruções"}
      </button>
    </form>
  );
}
