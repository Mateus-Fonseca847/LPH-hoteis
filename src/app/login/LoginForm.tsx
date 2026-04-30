"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";

import { normalizeRedirectTarget } from "@/lib/auth/redirect";

type LoginResponse = {
  error?: string;
  requiresTwoFactor?: boolean;
};

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function getRedirectTo() {
    return normalizeRedirectTarget(searchParams.get("redirectTo"));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });
      const data = (await response.json()) as LoginResponse;

      if (!response.ok) {
        setError(data.error ?? "Credenciais invalidas.");
        return;
      }

      const redirectTo = getRedirectTo();

      if (data.requiresTwoFactor) {
        router.push(`/auth/2fa?redirectTo=${encodeURIComponent(redirectTo)}`);
        return;
      }

      router.push(redirectTo);
      router.refresh();
    } catch {
      setError("Não foi possível concluir o login.");
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
          placeholder="voce@empresa.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </div>

      <div className="auth-field">
        <label htmlFor="password">Senha</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          placeholder="Sua senha"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </div>

      {error ? <p className="auth-error">{error}</p> : null}

      <button className="card-cta-button auth-submit" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Processando..." : "Entrar"}
      </button>
    </form>
  );
}
