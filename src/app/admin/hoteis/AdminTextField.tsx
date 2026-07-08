"use client";

import { useId, useState, type FormEvent, type InvalidEvent } from "react";

type AdminTextFieldProps = {
  name: string;
  label: string;
  as?: "input" | "textarea";
  type?: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  rows?: number;
  placeholder?: string;
  defaultValue?: string;
  helperText?: string;
  inputMode?: "text" | "email" | "tel" | "url" | "numeric" | "decimal" | "search";
  pattern?: string;
  autoComplete?: string;
  requiredMessage?: string;
  invalidMessage?: string;
};

function getFallbackValidationMessage(
  label: string,
  validity: ValidityState,
  minLength?: number,
  maxLength?: number,
  requiredMessage?: string,
  invalidMessage?: string
) {
  if (validity.valueMissing) {
    return requiredMessage ?? "Campo obrigatório.";
  }

  if (validity.tooShort && minLength) {
    return `${label} deve possuir pelo menos ${minLength} caracteres.`;
  }

  if (validity.tooLong && maxLength) {
    return `${label} pode ter no máximo ${maxLength} caracteres.`;
  }

  if (validity.typeMismatch || validity.patternMismatch || validity.badInput) {
    return invalidMessage ?? `${label} inválido.`;
  }

  return invalidMessage ?? "Verifique este campo.";
}

export function AdminTextField({
  name,
  label,
  as = "input",
  type = "text",
  required = false,
  minLength,
  maxLength,
  rows,
  placeholder,
  defaultValue = "",
  helperText,
  inputMode,
  pattern,
  autoComplete,
  requiredMessage,
  invalidMessage,
}: AdminTextFieldProps) {
  const id = useId();
  const helperId = `${id}-helper`;
  const counterId = `${id}-counter`;
  const errorId = `${id}-error`;
  const [length, setLength] = useState(defaultValue.length);
  const [error, setError] = useState("");
  const describedBy = [
    helperText ? helperId : null,
    maxLength ? counterId : null,
    error ? errorId : null,
  ]
    .filter(Boolean)
    .join(" ");

  function handleInvalid(event: InvalidEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const message = getFallbackValidationMessage(
      label,
      event.currentTarget.validity,
      minLength,
      maxLength,
      requiredMessage,
      invalidMessage
    );

    event.currentTarget.setCustomValidity(message);
    setError(message);
  }

  function handleInput(event: FormEvent<HTMLInputElement | HTMLTextAreaElement>) {
    event.currentTarget.setCustomValidity("");
    setLength(event.currentTarget.value.length);
    setError("");
  }

  const fieldProps = {
    id,
    name,
    required,
    minLength,
    maxLength,
    placeholder,
    defaultValue,
    inputMode,
    pattern,
    autoComplete,
    "aria-invalid": Boolean(error),
    "aria-describedby": describedBy || undefined,
    onInvalid: handleInvalid,
    onInput: handleInput,
  };

  return (
    <label className="admin-form-field">
      <span>{label}</span>
      {as === "textarea" ? (
        <textarea {...fieldProps} rows={rows} />
      ) : (
        <input {...fieldProps} type={type} />
      )}
      {helperText ? <small id={helperId}>{helperText}</small> : null}
      {maxLength ? (
        <small id={counterId} className="admin-character-counter">
          {length} / {maxLength}
        </small>
      ) : null}
      {error ? (
        <small id={errorId} className="admin-form-error" role="alert">
          {error}
        </small>
      ) : null}
    </label>
  );
}
