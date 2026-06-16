"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { PasswordInput } from "@/components/PasswordInput";

type SignupFormValues = {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
};

type SignupResponse = {
  error?: string;
  redirectTo?: string;
};

const initialValues: SignupFormValues = {
  name: "",
  email: "",
  password: "",
  confirmPassword: "",
};

function getPasswordChecks(password: string) {
  return {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /\d/.test(password),
  };
}

export function SignupForm() {
  const router = useRouter();
  const [values, setValues] = useState<SignupFormValues>(initialValues);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const passwordChecks = getPasswordChecks(values.password);

  function updateField(field: keyof SignupFormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setError("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      const data = (await response.json()) as SignupResponse;

      if (!response.ok) {
        setError(data.error ?? "Não foi possÃ­vel criar a conta.");
        return;
      }

      router.push(data.redirectTo ?? "/login?cadastro=sucesso");
      router.refresh();
    } catch {
      setError("Não foi possí­vel criar a conta.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="auth-form" noValidate onSubmit={handleSubmit}>
      <div className="auth-field">
        <label htmlFor="name">Nome</label>
        <input
          id="name"
          type="text"
          autoComplete="name"
          placeholder="Seu nome"
          value={values.name}
          onChange={(event) => updateField("name", event.target.value)}
          required
        />
      </div>

      <div className="auth-field">
        <label htmlFor="email">E-mail</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="Seu email"
          value={values.email}
          onChange={(event) => updateField("email", event.target.value)}
          required
        />
      </div>

      <div className="auth-field">
        <label htmlFor="password">Senha</label>
        <PasswordInput
          id="password"
          autoComplete="new-password"
          placeholder="Crie uma senha"
          value={values.password}
          onChange={(event) => updateField("password", event.target.value)}
          required
        />
        <ul className="auth-requirements">
          <li className={passwordChecks.minLength ? "is-met" : ""}>Mí­nimo de 8 caracteres</li>
          <li className={passwordChecks.hasUppercase ? "is-met" : ""}>Pelo menos uma maiúscula</li>
          <li className={passwordChecks.hasLowercase ? "is-met" : ""}>Pelo menos uma minúscula</li>
          <li className={passwordChecks.hasNumber ? "is-met" : ""}>Pelo menos um número</li>
        </ul>
      </div>

      <div className="auth-field">
        <label htmlFor="confirmPassword">Confirmar senha</label>
        <PasswordInput
          id="confirmPassword"
          autoComplete="new-password"
          placeholder="Repita a senha"
          value={values.confirmPassword}
          onChange={(event) => updateField("confirmPassword", event.target.value)}
          required
        />
      </div>

      {error ? (
        <p className="auth-error" role="alert">
          {error}
        </p>
      ) : null}

      <button className="card-cta-button auth-submit" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Criando..." : "Criar conta"}
      </button>
    </form>
  );
}
