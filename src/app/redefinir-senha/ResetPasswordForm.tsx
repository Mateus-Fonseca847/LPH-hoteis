"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { PasswordInput } from "@/components/PasswordInput";

type PasswordResetConfirmResponse = {
  message?: string;
  error?: string;
  redirectTo?: string;
};

function getPasswordChecks(password: string) {
  return {
    minLength: password.length >= 8,
    hasLetter: /[A-Za-z]/.test(password),
    hasNumber: /\d/.test(password),
  };
}

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const passwordChecks = getPasswordChecks(password);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/password-reset/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token, password, confirmPassword }),
      });
      const data = (await response.json()) as PasswordResetConfirmResponse;

      if (!response.ok) {
        setError(data.error ?? "Não foi possível redefinir a senha.");
        return;
      }

      setMessage(data.message ?? "Senha redefinida com sucesso.");
      setPassword("");
      setConfirmPassword("");
      setTimeout(() => {
        router.push(data.redirectTo ?? "/login");
      }, 900);
    } catch {
      setError("Não foi possível redefinir a senha.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!token) {
    return <p className="auth-error">Link de redefinição inválido ou expirado.</p>;
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <div className="auth-field">
        <label htmlFor="password">Nova senha</label>
        <PasswordInput
          id="password"
          autoComplete="new-password"
          placeholder="Nova senha"
          value={password}
          aria-describedby="password-rules"
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        <ul id="password-rules" className="auth-requirements">
          <li className={passwordChecks.minLength ? "is-met" : ""}>Mínimo de 8 caracteres</li>
          <li className={passwordChecks.hasLetter ? "is-met" : ""}>Pelo menos uma letra</li>
          <li className={passwordChecks.hasNumber ? "is-met" : ""}>Pelo menos um número</li>
        </ul>
      </div>

      <div className="auth-field">
        <label htmlFor="confirmPassword">Confirmar nova senha</label>
        <PasswordInput
          id="confirmPassword"
          autoComplete="new-password"
          placeholder="Confirme a nova senha"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          required
        />
      </div>

      {message ? <p className="auth-help">{message}</p> : null}
      {error ? <p className="auth-error">{error}</p> : null}

      <button className="card-cta-button auth-submit" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Salvando..." : "Redefinir senha"}
      </button>
    </form>
  );
}
