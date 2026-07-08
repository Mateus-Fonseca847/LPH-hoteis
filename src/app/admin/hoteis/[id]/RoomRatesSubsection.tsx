"use client";

import { useEffect, useState, useTransition } from "react";

import { getClientErrorMessage } from "@/lib/client-error-messages";
import { formatPriceLabel, getRateFormValues } from "./room-rate-form-helpers";
import { RoomRateFormCard } from "./RoomRateFormCard";
import type { AuthorizedRoomRate, RoomRateActionState } from "./room-rate-actions";
import { listRoomRatesAction } from "./room-rate-actions";

type RoomRatesSubsectionProps = {
  hotelId: string;
  roomId?: string;
};

export function RoomRatesSubsection({ hotelId, roomId }: RoomRatesSubsectionProps) {
  const [rates, setRates] = useState<AuthorizedRoomRate[]>([]);
  const [isLoadingRates, setIsLoadingRates] = useState(Boolean(roomId));
  const [feedback, setFeedback] = useState("");
  const [feedbackType, setFeedbackType] = useState<"success" | "error">("success");
  const [isCreating, setIsCreating] = useState(false);
  const [editingRateId, setEditingRateId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function refreshRates() {
    if (!roomId) {
      setRates([]);
      return;
    }

    const result = await listRoomRatesAction(hotelId, roomId);

    if (result.status === "error") {
      throw new Error(result.message || "Não foi possível atualizar a lista de tarifas.");
    }

    setRates(result.rates);
  }

  useEffect(() => {
    if (!roomId) {
      setIsLoadingRates(false);
      setRates([]);
      return;
    }

    let isMounted = true;
    setIsLoadingRates(true);

    void listRoomRatesAction(hotelId, roomId).then((result) => {
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
  }, [hotelId, roomId]);

  function handleRateFormSuccess(result: RoomRateActionState) {
    startTransition(async () => {
      try {
        await refreshRates();
        setFeedbackType("success");
        setFeedback(result.message);
        setIsCreating(false);
        setEditingRateId(null);
      } catch (error) {
        setFeedbackType("error");
        setFeedback(getClientErrorMessage(error, "Não foi possível atualizar a lista de tarifas."));
      }
    });
  }

  function handleRateFormError(message: string) {
    setFeedbackType("error");
    setFeedback(message);
  }

  return (
    <section className="admin-room-panel admin-room-panel--inline">
      <div className="admin-rooms-header">
        <div className="section-heading admin-subsection-heading">
          <h3>Tarifas do quarto</h3>
          <p className="admin-rooms-copy">Cadastre tarifas dentro de cada quarto.</p>
        </div>

        {roomId ? (
          <button
            type="button"
            className="card-cta-button admin-edit-button"
            onClick={() => {
              setIsCreating((current) => !current);
              setEditingRateId(null);
              setFeedback("");
            }}
            disabled={isPending}
          >
            {isCreating ? "Fechar" : "Criar tarifa"}
          </button>
        ) : null}
      </div>

      {!roomId ? (
        <div className="hotel-empty-state admin-history-empty">
          <strong>Salve o quarto antes de adicionar tarifas.</strong>
        </div>
      ) : (
        <>
          {feedback ? (
            <p
              className={`admin-editor-feedback ${
                feedbackType === "success" ? "is-success" : "is-error"
              }`}
              role={feedbackType === "error" ? "alert" : "status"}
            >
              {feedback}
            </p>
          ) : null}

          {isCreating ? (
            <RoomRateFormCard
              hotelId={hotelId}
              roomId={roomId}
              mode="create"
              title="Nova tarifa"
              submitLabel="Salvar tarifa"
              onSuccess={handleRateFormSuccess}
              onError={handleRateFormError}
              onCancel={() => setIsCreating(false)}
            />
          ) : null}

          {isLoadingRates ? (
            <div className="hotel-empty-state admin-history-empty">
              <strong>Carregando tarifas...</strong>
              <p>Aguarde enquanto as tarifas deste quarto são exibidas.</p>
            </div>
          ) : rates.length === 0 ? (
            <div className="hotel-empty-state admin-history-empty">
              <strong>Nenhuma tarifa cadastrada para este quarto.</strong>
              <p>Crie a primeira tarifa para este quarto.</p>
            </div>
          ) : (
            <div className="admin-rates-list">
              {rates.map((rate) => {
                const isEditing = editingRateId === rate.id;

                return (
                  <article key={rate.id} className="admin-room-card admin-rate-card">
                    <div className="admin-room-card-body">
                      <div className="admin-rate-compact-row">
                        <div className="admin-rate-compact-main">
                          <strong>{rate.name}</strong>
                          <span>{formatPriceLabel(rate.priceCents)}</span>
                        </div>

                        <span
                          className={`admin-room-badge admin-rate-compact-badge ${
                            rate.isActive ? "is-active" : "is-inactive"
                          }`}
                        >
                          {rate.isActive ? "Ativa" : "Inativa"}
                        </span>

                        <button
                          type="button"
                          className="admin-secondary-button admin-rate-open-button"
                          onClick={() => {
                            setIsCreating(false);
                            setEditingRateId((current) => (current === rate.id ? null : rate.id));
                          }}
                          disabled={isPending}
                        >
                          {isEditing ? "Fechar tarifa" : "Abrir tarifa"}
                        </button>
                      </div>

                      {isEditing ? (
                        <RoomRateFormCard
                          hotelId={hotelId}
                          roomId={roomId}
                          mode="edit"
                          rateId={rate.id}
                          title={`Editar ${rate.name}`}
                          submitLabel="Salvar"
                          initialValues={getRateFormValues(rate)}
                          onSuccess={handleRateFormSuccess}
                          onError={handleRateFormError}
                          onCancel={() => setEditingRateId(null)}
                        />
                      ) : null}
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
