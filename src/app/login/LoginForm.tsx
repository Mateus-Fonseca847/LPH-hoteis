"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

type LoginResponse = {
  error?: string;
  requiresTwoFactor?: boolean;
  requiresTwoFactorSetup?: boolean;
};

type TwoFactorSetupResponse = {
  error?: string;
  manualEntryKey?: string;
  otpauthUrl?: string;
};

type LoginFormProps = {
  initialStep?: "credentials" | "verify" | "setup";
};

export function LoginForm({ initialStep = "credentials" }: LoginFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [step, setStep] = useState<"credentials" | "verify" | "setup">(initialStep);
  const [manualEntryKey, setManualEntryKey] = useState("");
  const [otpauthUrl, setOtpauthUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setStep(initialStep);
  }, [initialStep]);

  useEffect(() => {
    async function loadPendingSetup() {
      if (initialStep !== "setup") {
        if (initialStep === "verify") {
          setInfo("Digite o código gerado no seu aplicativo autenticador.");
        }
        return;
      }

      try {
        const response = await fetch("/api/auth/2fa/setup", {
          method: "POST",
        });

        const data = (await response.json()) as TwoFactorSetupResponse;

        if (!response.ok || !data.manualEntryKey) {
          setError(data.error ?? "Não foi possível preparar o 2FA.");
          return;
        }

        setManualEntryKey(data.manualEntryKey);
        setOtpauthUrl(data.otpauthUrl ?? "");
        setInfo("Cadastre a chave no aplicativo autenticador e informe o código gerado.");
      } catch {
        setError("Não foi possível preparar o 2FA.");
      }
    }

    void loadPendingSetup();
  }, [initialStep]);

  useEffect(() => {
    if (step !== "setup") {
      setManualEntryKey("");
      setOtpauthUrl("");
    }
  }, [step]);

  async function redirectAfterLogin() {
    const redirectTo = searchParams.get("redirectTo") || "/";
    router.push(redirectTo);
    router.refresh();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setInfo("");
    setIsSubmitting(true);

    try {
      if (step === "credentials") {
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email, password }),
        });

        const data = (await response.json()) as LoginResponse;

        if (!response.ok) {
          setError(data.error ?? "Credenciais inválidas.");
          return;
        }

        if (data.requiresTwoFactorSetup) {
          const setupResponse = await fetch("/api/auth/2fa/setup", {
            method: "POST",
          });

          const setupData = (await setupResponse.json()) as TwoFactorSetupResponse;

          if (!setupResponse.ok || !setupData.manualEntryKey) {
            setError(setupData.error ?? "Não foi possível preparar o 2FA.");
            return;
          }

          setManualEntryKey(setupData.manualEntryKey);
          setOtpauthUrl(setupData.otpauthUrl ?? "");
          setStep("setup");
          setInfo("Cadastre a chave no aplicativo autenticador e informe o código gerado.");
          return;
        }

        if (data.requiresTwoFactor) {
          setStep("verify");
          setInfo("Digite o código gerado no seu aplicativo autenticador.");
          return;
        }

        await redirectAfterLogin();
        return;
      }

      const endpoint = step === "setup" ? "/api/auth/2fa/activate" : "/api/auth/2fa/verify";

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token }),
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(data.error ?? "Não foi possível validar o 2FA.");
        return;
      }

      await redirectAfterLogin();
    } catch {
      setError("Não foi possível concluir o login.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      {step === "credentials" ? (
        <>
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
        </>
      ) : (
        <>
          {step === "setup" ? (
            <div className="auth-field">
              <label>Chave do autenticador</label>
              <textarea
                className="auth-textarea"
                value={manualEntryKey}
                readOnly
                rows={3}
              />
              {otpauthUrl ? <small className="auth-help">Use esta chave ou URL no app autenticador.</small> : null}
            </div>
          ) : null}

          <div className="auth-field">
            <label htmlFor="token">Código de autenticação</label>
            <input
              id="token"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              required
            />
          </div>
        </>
      )}

      {info ? <p className="auth-help">{info}</p> : null}
      {error ? <p className="auth-error">{error}</p> : null}

      <button className="card-cta-button auth-submit" type="submit" disabled={isSubmitting}>
        {isSubmitting
          ? "Processando..."
          : step === "setup"
            ? "Ativar 2FA"
            : step === "verify"
              ? "Validar código"
              : "Entrar"}
      </button>
    </form>
  );
}
