"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import type { AuthorizedHotelRoom } from "./room-actions";
import type { AuthorizedRoomRate, RoomRateActionState } from "./room-rate-actions";
import {
  createRoomRateAction,
  listRoomRatesAction,
  toggleRoomRateActiveAction,
  updateRoomRateAction,
} from "./room-rate-actions";
import { createRoomRatePayloadSchema } from "@/lib/validations/room-rate";

type HotelRatesSectionProps = {
  hotelId: string;
  rooms: Pick<AuthorizedHotelRoom, "id" | "name">[];
};

type RateFormValues = {
  name: string;
  description: string;
  price: string;
  currency: string;
  startDate: string;
  endDate: string;
  minNights: string;
  maxGuests: string;
  refundable: boolean;
  breakfastIncluded: boolean;
  isActive: boolean;
};

type RateFormErrors = Partial<Record<keyof RateFormValues, string>> & {
  general?: string;
};

type RateFormMode = "create" | "edit";

type RateFormCardProps = {
  mode: RateFormMode;
  values: RateFormValues;
  errors: RateFormErrors;
  pending: boolean;
  title: string;
  submitLabel: string;
  onChange: (field: keyof RateFormValues, value: string | boolean) => void;
  onSubmit: () => void;
  onCancel: () => void;
};

const EMPTY_RATE_FORM: RateFormValues = {
  name: "",
  description: "",
  price: "",
  currency: "BRL",
  startDate: "",
  endDate: "",
  minNights: "1",
  maxGuests: "2",
  refundable: false,
  breakfastIncluded: false,
  isActive: true,
};

function formatDateInput(value: string) {
  return value.slice(0, 10);
}

function parsePriceToCents(value: string) {
  const normalized = value.replace(",", ".").trim();

  if (!normalized) {
    return Number.NaN;
  }

  return Math.round(Number(normalized) * 100);
}

function formatPriceFromCents(value: number) {
  return (value / 100).toFixed(2).replace(".", ",");
}

function formatPriceLabel(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value / 100);
}

function formatRatePeriod(rate: AuthorizedRoomRate) {
  const formatter = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
  });

  return `${formatter.format(new Date(rate.startDate))} - ${formatter.format(new Date(rate.endDate))}`;
}

function getRateFormValues(rate: AuthorizedRoomRate): RateFormValues {
  return {
    name: rate.name,
    description: rate.description,
    price: formatPriceFromCents(rate.priceCents),
    currency: rate.currency,
    startDate: formatDateInput(rate.startDate),
    endDate: formatDateInput(rate.endDate),
    minNights: String(rate.minNights),
    maxGuests: String(rate.maxGuests),
    refundable: rate.refundable,
    breakfastIncluded: rate.breakfastIncluded,
    isActive: rate.isActive,
  };
}

function buildRatePayload(roomId: string, values: RateFormValues) {
  return {
    roomId,
    name: values.name.trim(),
    description: values.description.trim(),
    priceCents: parsePriceToCents(values.price),
    currency: values.currency.trim().toUpperCase(),
    startDate: values.startDate,
    endDate: values.endDate,
    minNights: Number(values.minNights),
    maxGuests: Number(values.maxGuests),
    refundable: values.refundable,
    breakfastIncluded: values.breakfastIncluded,
    isActive: values.isActive,
  };
}

function validateRateForm(roomId: string, values: RateFormValues): RateFormErrors {
  const result = createRoomRatePayloadSchema.safeParse(buildRatePayload(roomId, values));

  if (result.success) {
    return {};
  }

  const nextErrors: RateFormErrors = {};

  for (const issue of result.error.issues) {
    const field = issue.path[0];

    if (typeof field === "string" && field !== "roomId" && !(field in nextErrors)) {
      nextErrors[field as keyof RateFormErrors] = issue.message;
    }
  }

  return nextErrors;
}

function RateFormCard({
  mode,
  values,
  errors,
  pending,
  title,
  submitLabel,
  onChange,
  onSubmit,
  onCancel,
}: RateFormCardProps) {
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
            onChange={(event) => onChange("name", event.target.value)}
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
            onChange={(event) => onChange("price", event.target.value)}
            aria-invalid={Boolean(errors.price)}
          />
          <small>Digite o valor em reais, usando vírgula se necessário.</small>
          {errors.price ? <small className="admin-form-error">{errors.price}</small> : null}
        </label>

        <label className="admin-form-field">
          <span>Moeda</span>
          <select
            value={values.currency}
            onChange={(event) => onChange("currency", event.target.value)}
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
            onChange={(event) => onChange("description", event.target.value)}
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
            onChange={(event) => onChange("startDate", event.target.value)}
            aria-invalid={Boolean(errors.startDate)}
          />
          {errors.startDate ? <small className="admin-form-error">{errors.startDate}</small> : null}
        </label>

        <label className="admin-form-field">
          <span>Data final</span>
          <input
            type="date"
            value={values.endDate}
            onChange={(event) => onChange("endDate", event.target.value)}
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
            onChange={(event) => onChange("minNights", event.target.value)}
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
            onChange={(event) => onChange("maxGuests", event.target.value)}
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
            onChange={(event) => onChange("refundable", event.target.checked)}
          />
          <span>Reembolsável</span>
        </label>

        <label className="admin-toggle-field">
          <input
            type="checkbox"
            checked={values.breakfastIncluded}
            onChange={(event) => onChange("breakfastIncluded", event.target.checked)}
          />
          <span>Café incluso</span>
        </label>

        <label className="admin-toggle-field">
          <input
            type="checkbox"
            checked={values.isActive}
            onChange={(event) => onChange("isActive", event.target.checked)}
          />
          <span>Tarifa ativa</span>
        </label>
      </div>

      <div className="admin-room-actions">
        <button
          type="button"
          className="card-cta-button admin-edit-button"
          onClick={onSubmit}
          disabled={pending}
        >
          {pending ? "Salvando..." : submitLabel}
        </button>

        <button
          type="button"
          className="admin-secondary-button"
          onClick={onCancel}
          disabled={pending}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

export function HotelRatesSection({ hotelId, rooms }: HotelRatesSectionProps) {
  const roomOptions = useMemo(
    () => rooms.map((room) => ({ id: room.id, name: room.name })),
    [rooms]
  );
  const [selectedRoomId, setSelectedRoomId] = useState(roomOptions[0]?.id ?? "");
  const [rates, setRates] = useState<AuthorizedRoomRate[]>([]);
  const [isLoadingRates, setIsLoadingRates] = useState(Boolean(roomOptions[0]?.id));
  const [feedback, setFeedback] = useState("");
  const [feedbackType, setFeedbackType] = useState<"success" | "error">("success");
  const [editingRateId, setEditingRateId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [createForm, setCreateForm] = useState<RateFormValues>(EMPTY_RATE_FORM);
  const [editForm, setEditForm] = useState<RateFormValues>(EMPTY_RATE_FORM);
  const [createErrors, setCreateErrors] = useState<RateFormErrors>({});
  const [editErrors, setEditErrors] = useState<RateFormErrors>({});
  const [pendingRateId, setPendingRateId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!selectedRoomId) {
      return;
    }

    let isMounted = true;

    void listRoomRatesAction(hotelId, selectedRoomId).then((result) => {
      if (!isMounted) {
        return;
      }

      if (result.status === "error") {
        setRates([]);
        setFeedbackType("error");
        setFeedback(result.message || "Não foi possível carregar as tarifas.");
      } else {
        setRates(result.rates);
      }

      setIsLoadingRates(false);
    });

    return () => {
      isMounted = false;
    };
  }, [hotelId, selectedRoomId]);

  const refreshRates = async () => {
    if (!selectedRoomId) {
      setRates([]);
      return;
    }

    const result = await listRoomRatesAction(hotelId, selectedRoomId);

    if (result.status === "error") {
      throw new Error(result.message || "Não foi possível atualizar a lista de tarifas.");
    }

    setRates(result.rates);
  };

  const runRateTask = (
    task: () => Promise<RoomRateActionState>,
    options?: {
      rateId?: string | null;
      onSuccess?: () => void;
    }
  ) => {
    setFeedback("");
    setPendingRateId(options?.rateId ?? null);

    startTransition(async () => {
      try {
        const result = await task();

        if (result.status === "error") {
          throw new Error(result.message || "Não foi possível concluir a operação.");
        }

        await refreshRates();
        options?.onSuccess?.();
        setFeedbackType("success");
        setFeedback(result.message);
      } catch (error) {
        setFeedbackType("error");
        setFeedback(
          error instanceof Error ? error.message : "Não foi possível concluir a operação."
        );
      } finally {
        setPendingRateId(null);
      }
    });
  };

  const handleCreateSubmit = () => {
    if (!selectedRoomId) {
      return;
    }

    const nextErrors = validateRateForm(selectedRoomId, createForm);
    setCreateErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setFeedback("");
      return;
    }

    runRateTask(
      () =>
        createRoomRateAction(hotelId, selectedRoomId, buildRatePayload(selectedRoomId, createForm)),
      {
        onSuccess: () => {
          setIsCreating(false);
          setCreateForm(EMPTY_RATE_FORM);
          setCreateErrors({});
        },
      }
    );
  };

  const handleEditSubmit = (rateId: string) => {
    if (!selectedRoomId) {
      return;
    }

    const nextErrors = validateRateForm(selectedRoomId, editForm);
    setEditErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setFeedback("");
      return;
    }

    runRateTask(
      () =>
        updateRoomRateAction(
          hotelId,
          selectedRoomId,
          rateId,
          buildRatePayload(selectedRoomId, editForm)
        ),
      {
        rateId,
        onSuccess: () => {
          setEditingRateId(null);
          setEditForm(EMPTY_RATE_FORM);
          setEditErrors({});
        },
      }
    );
  };

  const handleCreateChange = (field: keyof RateFormValues, value: string | boolean) => {
    setCreateForm((current) => ({ ...current, [field]: value }));
    setCreateErrors((current) => ({ ...current, [field]: undefined, general: undefined }));
  };

  const handleEditChange = (field: keyof RateFormValues, value: string | boolean) => {
    setEditForm((current) => ({ ...current, [field]: value }));
    setEditErrors((current) => ({ ...current, [field]: undefined, general: undefined }));
  };

  return (
    <section className="hotel-content-card admin-form-section admin-rates-section">
      <div className="admin-rooms-header">
        <div className="section-heading admin-subsection-heading">
          <h2>Tarifas</h2>
          <p className="admin-rooms-copy">
            Selecione um quarto para gerenciar preços, período e regras da tarifa.
          </p>
        </div>

        <button
          type="button"
          className="card-cta-button admin-edit-button"
          onClick={() => {
            setIsCreating((current) => !current);
            setEditingRateId(null);
            setCreateForm(EMPTY_RATE_FORM);
            setCreateErrors({});
            setEditErrors({});
          }}
          disabled={isPending || !selectedRoomId}
        >
          {isCreating ? "Fechar" : "Criar tarifa"}
        </button>
      </div>

      <div className="admin-rate-toolbar">
        <label className="admin-form-field admin-rate-room-select">
          <span>Quarto</span>
          <select
            value={selectedRoomId}
            onChange={(event) => {
              setIsLoadingRates(true);
              setSelectedRoomId(event.target.value);
              setIsCreating(false);
              setEditingRateId(null);
              setCreateErrors({});
              setEditErrors({});
              setFeedback("");
            }}
            disabled={roomOptions.length === 0 || isPending}
          >
            {roomOptions.length === 0 ? (
              <option value="">Nenhum quarto disponível</option>
            ) : (
              roomOptions.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name}
                </option>
              ))
            )}
          </select>
        </label>
      </div>

      {feedback ? (
        <p
          className={`admin-editor-feedback ${feedbackType === "success" ? "is-success" : "is-error"}`}
          role={feedbackType === "error" ? "alert" : "status"}
        >
          {feedback}
        </p>
      ) : null}

      {roomOptions.length === 0 ? (
        <div className="hotel-empty-state admin-history-empty">
          <strong>Nenhum quarto cadastrado.</strong>
          <p>Crie um quarto antes de cadastrar tarifas para este hotel.</p>
        </div>
      ) : (
        <>
          {isCreating ? (
            <RateFormCard
              mode="create"
              title="Nova tarifa"
              submitLabel="Salvar tarifa"
              values={createForm}
              errors={createErrors}
              pending={isPending && pendingRateId === null}
              onChange={handleCreateChange}
              onSubmit={handleCreateSubmit}
              onCancel={() => {
                setIsCreating(false);
                setCreateForm(EMPTY_RATE_FORM);
                setCreateErrors({});
              }}
            />
          ) : null}

          {isLoadingRates ? (
            <div className="hotel-empty-state admin-history-empty">
              <strong>Carregando tarifas...</strong>
              <p>Aguarde enquanto as tarifas do quarto selecionado são exibidas.</p>
            </div>
          ) : rates.length === 0 ? (
            <div className="hotel-empty-state admin-history-empty">
              <strong>Nenhuma tarifa cadastrada.</strong>
              <p>Crie a primeira tarifa para este quarto.</p>
            </div>
          ) : (
            <div className="admin-rates-list">
              {rates.map((rate) => {
                const isEditing = editingRateId === rate.id;
                const isRatePending = pendingRateId === rate.id;

                return (
                  <article key={rate.id} className="admin-room-card admin-rate-card">
                    <div className="admin-room-card-body">
                      <div className="admin-room-card-top">
                        <div>
                          <strong>{rate.name}</strong>
                          <p>{formatPriceLabel(rate.priceCents)}</p>
                        </div>

                        <span
                          className={`admin-room-badge ${rate.isActive ? "is-active" : "is-inactive"}`}
                        >
                          {rate.isActive ? "Ativa" : "Inativa"}
                        </span>
                      </div>

                      {isEditing ? (
                        <RateFormCard
                          mode="edit"
                          title={`Editar ${rate.name}`}
                          submitLabel="Salvar"
                          values={editForm}
                          errors={editErrors}
                          pending={isRatePending}
                          onChange={handleEditChange}
                          onSubmit={() => handleEditSubmit(rate.id)}
                          onCancel={() => {
                            setEditingRateId(null);
                            setEditForm(EMPTY_RATE_FORM);
                            setEditErrors({});
                          }}
                        />
                      ) : (
                        <>
                          <p className="admin-room-description">{rate.description}</p>

                          <div className="admin-rate-meta-grid">
                            <span>
                              <strong>Período</strong>
                              <small>{formatRatePeriod(rate)}</small>
                            </span>
                            <span>
                              <strong>Mín. noites</strong>
                              <small>{rate.minNights}</small>
                            </span>
                            <span>
                              <strong>Hóspedes</strong>
                              <small>{rate.maxGuests}</small>
                            </span>
                            <span>
                              <strong>Reembolso</strong>
                              <small>{rate.refundable ? "Sim" : "Não"}</small>
                            </span>
                            <span>
                              <strong>Café</strong>
                              <small>{rate.breakfastIncluded ? "Incluso" : "Não incluso"}</small>
                            </span>
                            <span>
                              <strong>Status</strong>
                              <small>{rate.isActive ? "Ativa" : "Inativa"}</small>
                            </span>
                          </div>

                          <div className="admin-room-actions">
                            <button
                              type="button"
                              className="admin-secondary-button"
                              onClick={() => {
                                setIsCreating(false);
                                setEditingRateId(rate.id);
                                setEditForm(getRateFormValues(rate));
                                setEditErrors({});
                              }}
                              disabled={isPending}
                            >
                              Editar
                            </button>

                            <button
                              type="button"
                              className="admin-secondary-button"
                              onClick={() =>
                                runRateTask(
                                  () =>
                                    toggleRoomRateActiveAction(
                                      hotelId,
                                      selectedRoomId,
                                      rate.id,
                                      !rate.isActive
                                    ),
                                  { rateId: rate.id }
                                )
                              }
                              disabled={isPending}
                            >
                              {isRatePending
                                ? "Atualizando..."
                                : rate.isActive
                                  ? "Desativar"
                                  : "Ativar"}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}
    </section>
  );
}
