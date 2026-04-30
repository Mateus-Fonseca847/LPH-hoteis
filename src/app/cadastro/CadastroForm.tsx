"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type CadastroFormValues = {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
};

type CadastroFormErrors = Partial<Record<keyof CadastroFormValues, string>> & {
  form?: string;
};

const initialValues: CadastroFormValues = {
  name: "",
  email: "",
  password: "",
  confirmPassword: "",
};

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function getPasswordChecks(password: string) {
  return {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /\d/.test(password),
  };
}

function validateForm(values: CadastroFormValues) {
  const errors: CadastroFormErrors = {};
  const name = values.name.trim();
  const email = values.email.trim();
  const passwordChecks = getPasswordChecks(values.password);
  const isStrongPassword = Object.values(passwordChecks).every(Boolean);

  if (name.length < 2) {
    errors.name = "Informe seu nome completo.";
  }

  if (!isValidEmail(email)) {
    errors.email = "Informe um e-mail válido.";
  }

  if (!isStrongPassword) {
    errors.password = "A senha ainda não atende aos requisitos mínimos.";
  }

  if (!values.confirmPassword) {
    errors.confirmPassword = "Confirme sua senha.";
  } else if (values.password !== values.confirmPassword) {
    errors.confirmPassword = "A confirmação de senha não confere.";
  }

  return errors;
}

export function CadastroForm() {
  const router = useRouter();
  const [values, setValues] = useState<CadastroFormValues>(initialValues);
  const [errors, setErrors] = useState<CadastroFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const passwordChecks = getPasswordChecks(values.password);

  function updateField(field: keyof CadastroFormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined, form: undefined }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors = validateForm(values);

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });
      const data = (await response.json()) as {
        error?: string;
        code?: string;
        redirectTo?: string;
      };

      if (!response.ok) {
        if (data.error === "Este e-mail já está cadastrado.") {
          setErrors({
            email: data.error,
          });
          return;
        }

        setErrors({
          form:
            data.code === "VALIDATION_ERROR"
              ? "Revise os dados informados."
              : "Não foi possível criar sua conta. Tente novamente em alguns instantes.",
        });
        return;
      }

      router.push(data.redirectTo ?? "/login");
      router.refresh();
    } catch {
      setErrors({
        form: "Não foi possível criar sua conta. Tente novamente em alguns instantes.",
      });
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
          value={values.name}
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? "name-error" : undefined}
          onChange={(event) => updateField("name", event.target.value)}
          required
        />
        {errors.name ? (
          <small id="name-error" className="auth-error">
            {errors.name}
          </small>
        ) : null}
      </div>

      <div className="auth-field">
        <label htmlFor="email">E-mail</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          value={values.email}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? "email-error" : undefined}
          onChange={(event) => updateField("email", event.target.value)}
          required
        />
        {errors.email ? (
          <small id="email-error" className="auth-error">
            {errors.email}
          </small>
        ) : null}
      </div>

      <div className="auth-field">
        <label htmlFor="password">Senha</label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          value={values.password}
          aria-invalid={Boolean(errors.password)}
          aria-describedby="password-rules"
          onChange={(event) => updateField("password", event.target.value)}
          required
        />
        <ul id="password-rules" className="auth-requirements">
          <li className={passwordChecks.minLength ? "is-met" : ""}>Mínimo de 8 caracteres</li>
          <li className={passwordChecks.hasUppercase ? "is-met" : ""}>Uma letra maiúscula</li>
          <li className={passwordChecks.hasLowercase ? "is-met" : ""}>Uma letra minúscula</li>
          <li className={passwordChecks.hasNumber ? "is-met" : ""}>Um número</li>
        </ul>
        {errors.password ? <small className="auth-error">{errors.password}</small> : null}
      </div>

      <div className="auth-field">
        <label htmlFor="confirmPassword">Confirmar senha</label>
        <input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          value={values.confirmPassword}
          aria-invalid={Boolean(errors.confirmPassword)}
          aria-describedby={errors.confirmPassword ? "confirm-password-error" : undefined}
          onChange={(event) => updateField("confirmPassword", event.target.value)}
          required
        />
        {errors.confirmPassword ? (
          <small id="confirm-password-error" className="auth-error">
            {errors.confirmPassword}
          </small>
        ) : null}
      </div>

      {errors.form ? (
        <p className="auth-error" role="alert">
          {errors.form}
        </p>
      ) : null}

      <button className="card-cta-button auth-submit" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Criando conta..." : "Criar conta"}
      </button>
    </form>
  );
}
