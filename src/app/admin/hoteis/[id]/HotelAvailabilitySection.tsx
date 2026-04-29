"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import {
  listRoomAvailabilityAction,
  saveRoomAvailabilityRangeAction,
  type AuthorizedRoomAvailability,
  type RoomAvailabilityActionState,
} from "./room-availability-actions";
import {
  bulkRoomAvailabilityPayloadSchema,
  roomAvailabilityIntervalPayloadSchema,
} from "@/lib/validations/room-availability";

type HotelAvailabilitySectionProps = {
  hotelId: string;
  rooms: {
    id: string;
    name: string;
  }[];
};

type AvailabilityFormValues = {
  startDate: string;
  endDate: string;
  totalUnits: string;
  availableUnits: string;
  closed: boolean;
  note: string;
};

type AvailabilityFormErrors = Partial<Record<keyof AvailabilityFormValues, string>> & {
  general?: string;
};

const DAY_MS = 86400000;

function formatDateInput(value: Date) {
  return value.toISOString().slice(0, 10);
}

function getInitialDateRange() {
  const start = new Date();
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 13);

  return {
    startDate: formatDateInput(start),
    endDate: formatDateInput(end),
  };
}

function getEmptyForm(): AvailabilityFormValues {
  const dates = getInitialDateRange();

  return {
    startDate: dates.startDate,
    endDate: dates.endDate,
    totalUnits: "1",
    availableUnits: "1",
    closed: false,
    note: "",
  };
}

function buildIntervalPayload(roomId: string, startDate: string, endDate: string) {
  return {
    roomId,
    startDate,
    endDate,
  };
}

function buildBulkPayload(roomId: string, values: AvailabilityFormValues) {
  return {
    roomId,
    startDate: values.startDate,
    endDate: values.endDate,
    totalUnits: Number(values.totalUnits),
    availableUnits: Number(values.availableUnits),
    closed: values.closed,
    note: values.note.trim() || undefined,
  };
}

function mapIssuesToErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const nextErrors: AvailabilityFormErrors = {};

  for (const issue of issues) {
    const field = issue.path[0];

    if (typeof field === "string" && !(field in nextErrors)) {
      nextErrors[field as keyof AvailabilityFormErrors] = issue.message;
    }
  }

  return nextErrors;
}

function validateInterval(roomId: string, startDate: string, endDate: string) {
  const result = roomAvailabilityIntervalPayloadSchema.safeParse(
    buildIntervalPayload(roomId, startDate, endDate)
  );

  if (result.success) {
    return {};
  }

  return mapIssuesToErrors(result.error.issues);
}

function validateBulk(roomId: string, values: AvailabilityFormValues) {
  const result = bulkRoomAvailabilityPayloadSchema.safeParse(buildBulkPayload(roomId, values));

  if (result.success) {
    return {};
  }

  return mapIssuesToErrors(result.error.issues);
}

function formatAvailabilityDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function getRangeLabel(startDate: string, endDate: string) {
  const startTime = new Date(`${startDate}T00:00:00.000Z`).getTime();
  const endTime = new Date(`${endDate}T00:00:00.000Z`).getTime();

  if (Number.isNaN(startTime) || Number.isNaN(endTime) || endTime < startTime) {
    return "Ajuste as datas";
  }

  const diffDays = Math.floor((endTime - startTime) / DAY_MS) + 1;

  return `${diffDays} dia${diffDays > 1 ? "s" : ""}`;
}

async function refreshAvailabilityList(
  hotelId: string,
  roomId: string,
  startDate: string,
  endDate: string
) {
  const result = await listRoomAvailabilityAction(
    hotelId,
    roomId,
    buildIntervalPayload(roomId, startDate, endDate)
  );

  if (result.status === "error") {
    throw new Error(result.message || "Não foi possível carregar a disponibilidade.");
  }

  return result.availability;
}

export function HotelAvailabilitySection({ hotelId, rooms }: HotelAvailabilitySectionProps) {
  const roomOptions = useMemo(
    () => rooms.map((room) => ({ id: room.id, name: room.name })),
    [rooms]
  );
  const [selectedRoomId, setSelectedRoomId] = useState(roomOptions[0]?.id ?? "");
  const [form, setForm] = useState<AvailabilityFormValues>(() => getEmptyForm());
  const [errors, setErrors] = useState<AvailabilityFormErrors>({});
  const [feedback, setFeedback] = useState("");
  const [feedbackType, setFeedbackType] = useState<"success" | "error">("success");
  const [availability, setAvailability] = useState<AuthorizedRoomAvailability[]>([]);
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(Boolean(roomOptions[0]?.id));
  const [isPending, startTransition] = useTransition();

  const intervalErrors = selectedRoomId
    ? validateInterval(selectedRoomId, form.startDate, form.endDate)
    : {};
  const hasIntervalErrors = Object.keys(intervalErrors).length > 0;
  const displayedAvailability = hasIntervalErrors ? [] : availability;

  useEffect(() => {
    if (!selectedRoomId || hasIntervalErrors) {
      return;
    }

    let isMounted = true;
    const loadAvailability = async () => {
      setIsLoadingAvailability(true);

      try {
        const rows = await refreshAvailabilityList(
          hotelId,
          selectedRoomId,
          form.startDate,
          form.endDate
        );

        if (!isMounted) {
          return;
        }

        setAvailability(rows);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setFeedbackType("error");
        setFeedback(
          error instanceof Error ? error.message : "Não foi possível carregar a disponibilidade."
        );
        setAvailability([]);
      } finally {
        if (isMounted) {
          setIsLoadingAvailability(false);
        }
      }
    };

    void loadAvailability();

    return () => {
      isMounted = false;
    };
  }, [form.endDate, form.startDate, hasIntervalErrors, hotelId, selectedRoomId]);

  const handleChange = (field: keyof AvailabilityFormValues, value: string | boolean) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined, general: undefined }));
  };

  const handleSave = () => {
    if (!selectedRoomId) {
      setErrors({ general: "Selecione um quarto para continuar." });
      return;
    }

    const nextErrors = validateBulk(selectedRoomId, form);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setFeedback("");
      return;
    }

    setFeedback("");

    startTransition(async () => {
      try {
        const result: RoomAvailabilityActionState = await saveRoomAvailabilityRangeAction(
          hotelId,
          selectedRoomId,
          buildBulkPayload(selectedRoomId, form)
        );

        if (result.status === "error") {
          throw new Error(result.message || "Não foi possível salvar a disponibilidade.");
        }

        const rows = await refreshAvailabilityList(
          hotelId,
          selectedRoomId,
          form.startDate,
          form.endDate
        );

        setAvailability(rows);
        setFeedbackType("success");
        setFeedback(result.message);
      } catch (error) {
        setFeedbackType("error");
        setFeedback(
          error instanceof Error ? error.message : "Não foi possível salvar a disponibilidade."
        );
      }
    });
  };

  return (
    <section className="hotel-content-card admin-form-section admin-availability-section">
      <div className="admin-rooms-header">
        <div className="section-heading admin-subsection-heading">
          <h2>Disponibilidade</h2>
          <p className="admin-rooms-copy">
            Defina o estoque do quarto por período. O salvamento em lote aplica os mesmos valores a
            todas as datas selecionadas.
          </p>
        </div>
      </div>

      <div className="admin-availability-toolbar">
        <label className="admin-form-field admin-rate-room-select">
          <span>Quarto</span>
          <select
            value={selectedRoomId}
            onChange={(event) => {
              setSelectedRoomId(event.target.value);
              setFeedback("");
              setErrors({});
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
          <p>Cadastre um quarto antes de definir disponibilidade.</p>
        </div>
      ) : (
        <>
          <div className="admin-room-panel">
            {errors.general ? (
              <p className="admin-form-error admin-form-error--block">{errors.general}</p>
            ) : null}

            <div className="admin-form-grid admin-form-grid--three">
              <label className="admin-form-field">
                <span>Data inicial</span>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(event) => handleChange("startDate", event.target.value)}
                  aria-invalid={Boolean(errors.startDate || intervalErrors.startDate)}
                />
                {errors.startDate || intervalErrors.startDate ? (
                  <small className="admin-form-error">
                    {errors.startDate || intervalErrors.startDate}
                  </small>
                ) : null}
              </label>

              <label className="admin-form-field">
                <span>Data final</span>
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(event) => handleChange("endDate", event.target.value)}
                  aria-invalid={Boolean(errors.endDate || intervalErrors.endDate)}
                />
                {errors.endDate || intervalErrors.endDate ? (
                  <small className="admin-form-error">
                    {errors.endDate || intervalErrors.endDate}
                  </small>
                ) : null}
              </label>

              <label className="admin-form-field">
                <span>Intervalo</span>
                <input value={getRangeLabel(form.startDate, form.endDate)} readOnly />
                <small>Limite máximo: 180 dias por ação.</small>
              </label>

              <label className="admin-form-field">
                <span>Unidades totais</span>
                <input
                  type="number"
                  min="0"
                  value={form.totalUnits}
                  onChange={(event) => handleChange("totalUnits", event.target.value)}
                  aria-invalid={Boolean(errors.totalUnits)}
                />
                {errors.totalUnits ? (
                  <small className="admin-form-error">{errors.totalUnits}</small>
                ) : null}
              </label>

              <label className="admin-form-field">
                <span>Unidades disponíveis</span>
                <input
                  type="number"
                  min="0"
                  value={form.availableUnits}
                  onChange={(event) => handleChange("availableUnits", event.target.value)}
                  aria-invalid={Boolean(errors.availableUnits)}
                />
                {errors.availableUnits ? (
                  <small className="admin-form-error">{errors.availableUnits}</small>
                ) : null}
              </label>

              <label className="admin-toggle-field admin-toggle-field--boxed">
                <input
                  type="checkbox"
                  checked={form.closed}
                  onChange={(event) => handleChange("closed", event.target.checked)}
                />
                <span>Fechado no período</span>
              </label>

              <label className="admin-form-field admin-form-field--full">
                <span>Observação interna</span>
                <textarea
                  rows={4}
                  value={form.note}
                  onChange={(event) => handleChange("note", event.target.value)}
                  aria-invalid={Boolean(errors.note)}
                />
                {errors.note ? <small className="admin-form-error">{errors.note}</small> : null}
              </label>
            </div>

            <div className="admin-room-actions">
              <button
                type="button"
                className="card-cta-button admin-edit-button"
                onClick={handleSave}
                disabled={isPending || !selectedRoomId}
              >
                {isPending ? "Salvando..." : "Salvar em lote"}
              </button>
            </div>
          </div>

          {isLoadingAvailability ? (
            <div className="hotel-empty-state admin-history-empty">
              <strong>Carregando disponibilidade...</strong>
              <p>Aguarde enquanto o período selecionado é consultado.</p>
            </div>
          ) : displayedAvailability.length === 0 ? (
            <div className="hotel-empty-state admin-history-empty">
              <strong>Nenhuma disponibilidade cadastrada.</strong>
              <p>Use o formulário acima para preencher este período.</p>
            </div>
          ) : (
            <div className="admin-availability-list">
              {displayedAvailability.map((entry) => (
                <article key={entry.id} className="admin-room-card admin-availability-card">
                  <div className="admin-room-card-body">
                    <div className="admin-room-card-top">
                      <div>
                        <strong>{formatAvailabilityDate(entry.date)}</strong>
                        <p>
                          {entry.closed
                            ? "Fechado para venda"
                            : `${entry.availableUnits} de ${entry.totalUnits} unidades disponíveis`}
                        </p>
                      </div>

                      <span
                        className={`admin-room-badge ${entry.closed ? "is-inactive" : "is-active"}`}
                      >
                        {entry.closed ? "Fechado" : "Aberto"}
                      </span>
                    </div>

                    <div className="admin-rate-meta-grid admin-availability-meta-grid">
                      <span>
                        <strong>Total</strong>
                        <small>{entry.totalUnits}</small>
                      </span>
                      <span>
                        <strong>Disponíveis</strong>
                        <small>{entry.availableUnits}</small>
                      </span>
                      <span>
                        <strong>Status</strong>
                        <small>{entry.closed ? "Fechado" : "Aberto"}</small>
                      </span>
                    </div>

                    {entry.note ? <p className="admin-availability-note">{entry.note}</p> : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
