"use client";

import { useEffect, useState, useTransition } from "react";

import type { RoomRateActionState } from "./room-rate-actions";
import { createRoomRateAction, updateRoomRateAction } from "./room-rate-actions";
import {
  buildRatePayload,
  EMPTY_RATE_FORM,
  type RateFormErrors,
  type RateFormMode,
  type RateFormValues,
  validateRateForm,
} from "./room-rate-form-helpers";

type RoomRateFormCardProps = {
  hotelId: string;
  roomId: string;
  mode: RateFormMode;
  rateId?: string;
  initialValues?: RateFormValues;
  title: string;
  submitLabel: string;
  onSuccess: (result: RoomRateActionState) => void | Promise<void>;
  onError: (message: string) => void;
  onCancel: () => void;
};

export function RoomRateFormCard({
  hotelId,
  roomId,
  mode,
  rateId,
  initialValues = EMPTY_RATE_FORM,
  title,
  submitLabel,
  onSuccess,
  onError,
  onCancel,
}: RoomRateFormCardProps) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<RateFormErrors>({});
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setValues(initialValues);
    setErrors({});
  }, [initialValues]);

  function handleChange(field: keyof RateFormValues, value: string | boolean) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined, general: undefined }));
  }

  function handleSubmit() {
    const nextErrors = validateRateForm(roomId, values);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    startTransition(async () => {
      try {
        const payload = buildRatePayload(roomId, values);
        const result =
          mode === "edit"
            ? await updateRoomRateAction(hotelId, roomId, String(rateId), payload)
            : await createRoomRateAction(hotelId, roomId, payload);

        if (result.status === "error") {
          throw new Error(result.message || "Não foi possível concluir a operação.");
        }

        await onSuccess(result);

        if (mode === "create") {
          setValues(EMPTY_RATE_FORM);
        }
      } catch (error) {
        onError(error instanceof Error ? error.message : "Não foi possível concluir a operação.");
      }
    });
  }

  return (
    <div className={`admin-room-panel ${mode === "edit" ? "admin-room-panel--inline" : ""}`}>
      <div className="admin-room-panel-heading">
        <strong>{title}</strong>
      </div>

      {errors.general ? (
        <p className="admin-form-error admin-form-error--block">{errors.general}</p>
      ) : null}

      <div className="admin-form-grid admin-form-grid--two">
        <label className="admin-form-field">
          <span>Nome</span>
          <input
            value={values.name}
            onChange={(event) => handleChange("name", event.target.value)}
            aria-invalid={Boolean(errors.name)}
          />
          {errors.name ? <small className="admin-form-error">{errors.name}</small> : null}
        </label>

        <label className="admin-form-field">
          <span>Preço em reais</span>
          <input
            inputMode="decimal"
            placeholder="0,00"
            value={values.price}
            onChange={(event) => handleChange("price", event.target.value)}
            aria-invalid={Boolean(errors.price)}
          />
          <small>Digite o valor em reais, usando vírgula se necessário.</small>
          {errors.price ? <small className="admin-form-error">{errors.price}</small> : null}
        </label>

        <label className="admin-form-field">
          <span>Moeda</span>
          <select
            value={values.currency}
            onChange={(event) => handleChange("currency", event.target.value)}
            aria-invalid={Boolean(errors.currency)}
          >
            <option value="BRL">BRL - Real brasileiro</option>
          </select>
          {errors.currency ? <small className="admin-form-error">{errors.currency}</small> : null}
        </label>

        <label className="admin-form-field admin-form-field--full">
          <span>Descrição</span>
          <textarea
            rows={4}
            value={values.description}
            onChange={(event) => handleChange("description", event.target.value)}
            aria-invalid={Boolean(errors.description)}
          />
          {errors.description ? (
            <small className="admin-form-error">{errors.description}</small>
          ) : null}
        </label>

        <label className="admin-form-field">
          <span>Data inicial</span>
          <input
            type="date"
            value={values.startDate}
            onChange={(event) => handleChange("startDate", event.target.value)}
            aria-invalid={Boolean(errors.startDate)}
          />
          {errors.startDate ? <small className="admin-form-error">{errors.startDate}</small> : null}
        </label>

        <label className="admin-form-field">
          <span>Data final</span>
          <input
            type="date"
            value={values.endDate}
            onChange={(event) => handleChange("endDate", event.target.value)}
            aria-invalid={Boolean(errors.endDate)}
          />
          {errors.endDate ? <small className="admin-form-error">{errors.endDate}</small> : null}
        </label>

        <label className="admin-form-field">
          <span>Mínimo de noites</span>
          <input
            type="number"
            min="1"
            value={values.minNights}
            onChange={(event) => handleChange("minNights", event.target.value)}
            aria-invalid={Boolean(errors.minNights)}
          />
          {errors.minNights ? <small className="admin-form-error">{errors.minNights}</small> : null}
        </label>

        <label className="admin-form-field">
          <span>Hóspedes máximos</span>
          <input
            type="number"
            min="1"
            value={values.maxGuests}
            onChange={(event) => handleChange("maxGuests", event.target.value)}
            aria-invalid={Boolean(errors.maxGuests)}
          />
          {errors.maxGuests ? <small className="admin-form-error">{errors.maxGuests}</small> : null}
        </label>
      </div>

      <div className="admin-rate-toggles">
        <label className="admin-toggle-field">
          <input
            type="checkbox"
            checked={values.refundable}
            onChange={(event) => handleChange("refundable", event.target.checked)}
          />
          <span>Reembolsável</span>
        </label>

        <label className="admin-toggle-field">
          <input
            type="checkbox"
            checked={values.breakfastIncluded}
            onChange={(event) => handleChange("breakfastIncluded", event.target.checked)}
          />
          <span>Café incluso</span>
        </label>

        <label className="admin-toggle-field">
          <input
            type="checkbox"
            checked={values.isActive}
            onChange={(event) => handleChange("isActive", event.target.checked)}
          />
          <span>Tarifa ativa</span>
        </label>
      </div>

      <div className="admin-room-actions">
        <button
          type="button"
          className="card-cta-button admin-edit-button"
          onClick={handleSubmit}
          disabled={isPending}
        >
          {isPending ? "Salvando..." : submitLabel}
        </button>

        <button
          type="button"
          className="admin-secondary-button"
          onClick={onCancel}
          disabled={isPending}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
