"use client";

import { FormEvent, useState } from "react";

type CadastroFormValues = {
  responsibleName: string;
  email: string;
  phone: string;
  hotelName: string;
  hotelCity: string;
  hotelState: string;
  hotelDocument: string;
  message: string;
};

type CadastroFormErrors = Partial<Record<keyof CadastroFormValues, string>> & {
  form?: string;
};

type SignupResponse = {
  error?: string;
  code?: string;
  message?: string;
};

const BRAZILIAN_STATES = new Set([
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
]);

const initialValues: CadastroFormValues = {
  responsibleName: "",
  email: "",
  phone: "",
  hotelName: "",
  hotelCity: "",
  hotelState: "",
  hotelDocument: "",
  message: "",
};

const SUCCESS_MESSAGE = "Solicitação enviada com sucesso. A equipe LPH analisará seu cadastro.";

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validateForm(values: CadastroFormValues) {
  const errors: CadastroFormErrors = {};

  if (values.responsibleName.trim().length < 3) {
    errors.responsibleName = "Informe o nome do responsável.";
  }

  if (!isValidEmail(values.email.trim())) {
    errors.email = "Informe um e-mail válido.";
  }

  if (!values.phone.trim()) {
    errors.phone = "Informe um telefone ou WhatsApp.";
  }

  if (!values.hotelName.trim()) {
    errors.hotelName = "Informe o nome do hotel ou pousada.";
  }

  if (!values.hotelCity.trim()) {
    errors.hotelCity = "Informe a cidade do hotel.";
  }

  if (!BRAZILIAN_STATES.has(values.hotelState.trim().toUpperCase())) {
    errors.hotelState = "Informe uma UF válida.";
  }

  if (values.message.length > 1000) {
    errors.message = "Mensagem deve ter no máximo 1000 caracteres.";
  }

  return errors;
}

function buildPayload(values: CadastroFormValues) {
  return {
    responsibleName: values.responsibleName,
    email: values.email,
    phone: values.phone,
    hotelName: values.hotelName,
    hotelCity: values.hotelCity,
    hotelState: values.hotelState,
    hotelDocument: values.hotelDocument || undefined,
    message: values.message || undefined,
  };
}

export function CadastroForm() {
  const [values, setValues] = useState<CadastroFormValues>(initialValues);
  const [errors, setErrors] = useState<CadastroFormErrors>({});
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateField(field: keyof CadastroFormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setSuccessMessage("");
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
    setSuccessMessage("");

    try {
      const response = await fetch("/api/hotel-owner-signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buildPayload(values)),
      });
      const data = (await response.json()) as SignupResponse;

      if (!response.ok) {
        if (
          data.error === "Já existe usuário com este e-mail." ||
          data.error === "Já existe uma solicitação pendente para este e-mail." ||
          data.error?.toLowerCase().includes("e-mail")
        ) {
          setErrors({ email: data.error });
          return;
        }

        setErrors({
          form:
            data.code === "VALIDATION_ERROR"
              ? "Revise os dados obrigatórios."
              : "Não foi possível enviar a solicitação. Tente novamente em alguns instantes.",
        });
        return;
      }

      setValues(initialValues);
      setSuccessMessage(data.message ?? SUCCESS_MESSAGE);
    } catch {
      setErrors({
        form: "Não foi possível enviar a solicitação. Tente novamente em alguns instantes.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="auth-form" noValidate onSubmit={handleSubmit}>
      <p className="auth-help">
        O acesso administrativo será liberado somente após aprovação da equipe LPH.
      </p>

      <div className="auth-field">
        <label htmlFor="responsibleName">Nome do responsável</label>
        <input
          id="responsibleName"
          type="text"
          autoComplete="name"
          value={values.responsibleName}
          aria-invalid={Boolean(errors.responsibleName)}
          aria-describedby={errors.responsibleName ? "responsible-name-error" : undefined}
          onChange={(event) => updateField("responsibleName", event.target.value)}
          required
        />
        {errors.responsibleName ? (
          <small id="responsible-name-error" className="auth-error">
            {errors.responsibleName}
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
        <label htmlFor="phone">Telefone/WhatsApp</label>
        <input
          id="phone"
          type="tel"
          autoComplete="tel"
          value={values.phone}
          aria-invalid={Boolean(errors.phone)}
          aria-describedby={errors.phone ? "phone-error" : undefined}
          onChange={(event) => updateField("phone", event.target.value)}
          required
        />
        {errors.phone ? (
          <small id="phone-error" className="auth-error">
            {errors.phone}
          </small>
        ) : null}
      </div>

      <div className="auth-field">
        <label htmlFor="hotelName">Nome do hotel/pousada</label>
        <input
          id="hotelName"
          type="text"
          value={values.hotelName}
          aria-invalid={Boolean(errors.hotelName)}
          aria-describedby={errors.hotelName ? "hotel-name-error" : undefined}
          onChange={(event) => updateField("hotelName", event.target.value)}
          required
        />
        {errors.hotelName ? (
          <small id="hotel-name-error" className="auth-error">
            {errors.hotelName}
          </small>
        ) : null}
      </div>

      <div className="auth-field">
        <label htmlFor="hotelCity">Cidade</label>
        <input
          id="hotelCity"
          type="text"
          value={values.hotelCity}
          aria-invalid={Boolean(errors.hotelCity)}
          aria-describedby={errors.hotelCity ? "hotel-city-error" : undefined}
          onChange={(event) => updateField("hotelCity", event.target.value)}
          required
        />
        {errors.hotelCity ? (
          <small id="hotel-city-error" className="auth-error">
            {errors.hotelCity}
          </small>
        ) : null}
      </div>

      <div className="auth-field">
        <label htmlFor="hotelState">Estado</label>
        <input
          id="hotelState"
          type="text"
          inputMode="text"
          maxLength={2}
          placeholder="UF"
          value={values.hotelState}
          aria-invalid={Boolean(errors.hotelState)}
          aria-describedby={errors.hotelState ? "hotel-state-error" : undefined}
          onChange={(event) => updateField("hotelState", event.target.value.toUpperCase())}
          required
        />
        {errors.hotelState ? (
          <small id="hotel-state-error" className="auth-error">
            {errors.hotelState}
          </small>
        ) : null}
      </div>

      <div className="auth-field">
        <label htmlFor="hotelDocument">Documento do hotel</label>
        <input
          id="hotelDocument"
          type="text"
          value={values.hotelDocument}
          onChange={(event) => updateField("hotelDocument", event.target.value)}
        />
      </div>

      <div className="auth-field">
        <label htmlFor="message">Mensagem/observações</label>
        <textarea
          id="message"
          value={values.message}
          aria-invalid={Boolean(errors.message)}
          aria-describedby={errors.message ? "message-error" : undefined}
          onChange={(event) => updateField("message", event.target.value)}
          rows={4}
        />
        {errors.message ? (
          <small id="message-error" className="auth-error">
            {errors.message}
          </small>
        ) : null}
      </div>

      {successMessage ? (
        <p className="auth-help" role="status">
          {successMessage}
        </p>
      ) : null}

      {errors.form ? (
        <p className="auth-error" role="alert">
          {errors.form}
        </p>
      ) : null}

      <button className="card-cta-button auth-submit" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Enviando..." : "Enviar solicitação"}
      </button>
    </form>
  );
}
