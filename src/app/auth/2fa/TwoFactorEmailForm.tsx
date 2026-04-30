"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

type VerifyResponse = {
  error?: string;
};

type ResendResponse = {
  error?: string;
  message?: string;
};

type TwoFactorEmailFormProps = {
  redirectTo: string;
};

const INITIAL_RESEND_COOLDOWN_SECONDS = 60;

function getRetryAfterSeconds(response: Response) {
  const retryAfter = Number.parseInt(response.headers.get("Retry-After") ?? "", 10);

  return Number.isFinite(retryAfter) && retryAfter > 0
    ? retryAfter
    : INITIAL_RESEND_COOLDOWN_SECONDS;
}

export function TwoFactorEmailForm({ redirectTo }: TwoFactorEmailFormProps) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(INITIAL_RESEND_COOLDOWN_SECONDS);

  useEffect(() => {
    if (resendCooldown <= 0) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setResendCooldown((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [resendCooldown]);

  function handleCodeChange(value: string) {
    setCode(value.replace(/\D/g, "").slice(0, 6));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setInfo("");

    if (code.length !== 6) {
      setError("Informe o código de 6 dígitos.");
      return;
    }

    setIsVerifying(true);

    try {
      const response = await fetch("/api/auth/2fa/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token: code }),
      });
      const data = (await response.json()) as VerifyResponse;

      if (!response.ok) {
        setError(data.error ?? "Código inválido.");
        return;
      }

      router.push(redirectTo);
      router.refresh();
    } catch {
      setError("Não foi possível verificar o código.");
    } finally {
      setIsVerifying(false);
    }
  }

  async function handleResend() {
    if (resendCooldown > 0 || isResending) {
      return;
    }

    setError("");
    setInfo("");
    setIsResending(true);

    try {
      const response = await fetch("/api/auth/2fa/email/request", {
        method: "POST",
      });
      const data = (await response.json()) as ResendResponse;
      const nextCooldown = getRetryAfterSeconds(response);

      setResendCooldown(nextCooldown);

      if (!response.ok) {
        setError(data.error ?? "Muitas tentativas. Aguarde para solicitar um novo código.");
        return;
      }

      setInfo(data.message ?? "Se possível, enviaremos um novo código para o e-mail cadastrado.");
    } catch {
      setError("Não foi possível reenviar o código.");
    } finally {
      setIsResending(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <div className="auth-field">
        <label htmlFor="two-factor-code">Código de 6 dígitos</label>
        <input
          id="two-factor-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="000000"
          value={code}
          onChange={(event) => handleCodeChange(event.target.value)}
          aria-describedby="two-factor-help"
          required
        />
      </div>

      <p id="two-factor-help" className="auth-help">
        O código expira em poucos minutos. Se ele vencer, solicite um novo envio.
      </p>

      {info ? <p className="auth-help">{info}</p> : null}
      {error ? <p className="auth-error">{error}</p> : null}

      <button className="card-cta-button auth-submit" type="submit" disabled={isVerifying}>
        {isVerifying ? "Verificando..." : "Verificar código"}
      </button>

      <button
        className="auth-secondary-button"
        type="button"
        onClick={handleResend}
        disabled={resendCooldown > 0 || isResending}
      >
        {isResending
          ? "Reenviando..."
          : resendCooldown > 0
            ? `Reenviar código em ${resendCooldown}s`
            : "Reenviar código"}
      </button>
    </form>
  );
}
