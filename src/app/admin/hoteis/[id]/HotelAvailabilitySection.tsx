"use client";

import { useCallback, useMemo, useState } from "react";

import {
  listRoomAvailabilityAction,
  saveRoomAvailabilityRangeAction,
  type AuthorizedRoomAvailability,
  type RoomAvailabilityActionState,
} from "./room-availability-actions";
import { RoomAvailabilityCalendar } from "./RoomAvailabilityCalendar";
import {
  getMonthRange,
  toUtcDate,
  type CalendarSavePayload,
} from "./RoomAvailabilityCalendarLogic";

type HotelAvailabilityRoom = {
  id: string;
  name: string;
  capacityAdults: number;
  capacityChildren: number;
  capacity: number;
  isActive: boolean;
};

type HotelAvailabilitySectionProps = {
  hotelId: string;
  rooms: HotelAvailabilityRoom[];
};

type RoomCalendarState = {
  isOpen: boolean;
  isLoading: boolean;
  startDate: string;
  endDate: string;
  availability: AuthorizedRoomAvailability[];
  feedback: string;
  feedbackType: "success" | "error";
};

const MAX_RANGE_DAYS = 180;

function buildIntervalPayload(roomId: string, startDate: string, endDate: string) {
  return {
    roomId,
    startDate,
    endDate,
  };
}

function getDefaultRoomState(): RoomCalendarState {
  const range = getMonthRange(new Date().toISOString().slice(0, 7));

  return {
    isOpen: false,
    isLoading: false,
    startDate: range.startDate,
    endDate: range.endDate,
    availability: [],
    feedback: "",
    feedbackType: "success",
  };
}

function getDateRangeDays(startDate: string, endDate: string) {
  const start = toUtcDate(startDate).getTime();
  const end = toUtcDate(endDate).getTime();

  if (Number.isNaN(start) || Number.isNaN(end) || end < start) {
    return 0;
  }

  return Math.floor((end - start) / 86400000) + 1;
}

function getAvailabilitySuccessMessage(payload: CalendarSavePayload) {
  if (payload.closed) {
    return "Período fechado para reservas.";
  }

  if (payload.availableUnits < 1) {
    return "Período marcado como ocupado.";
  }

  return "Período liberado para reservas.";
}

function getRoomSummary(
  availability: AuthorizedRoomAvailability[],
  startDate: string,
  endDate: string
) {
  const rangeDays = getDateRangeDays(startDate, endDate);

  if (availability.length === 0) {
    return `${rangeDays} dias sem cadastro.`;
  }

  const closedDays = availability.filter((entry) => entry.closed).length;
  const occupiedDays = availability.filter(
    (entry) => !entry.closed && entry.availableUnits < 1
  ).length;
  const availableDays = availability.filter(
    (entry) => !entry.closed && entry.availableUnits > 0
  ).length;
  const emptyDays = Math.max(rangeDays - availability.length, 0);

  return `${availableDays} disponíveis · ${occupiedDays} ocupados · ${closedDays} fechados · ${emptyDays} sem cadastro`;
}

async function refreshRoomAvailability(
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
  const roomCards = useMemo(() => rooms, [rooms]);
  const [roomStates, setRoomStates] = useState<Record<string, RoomCalendarState>>({});

  const getRoomState = useCallback(
    (roomId: string) => roomStates[roomId] ?? getDefaultRoomState(),
    [roomStates]
  );

  const patchRoomState = useCallback((roomId: string, patch: Partial<RoomCalendarState>) => {
    setRoomStates((current) => ({
      ...current,
      [roomId]: {
        ...(current[roomId] ?? getDefaultRoomState()),
        ...patch,
      },
    }));
  }, []);

  const loadRoomAvailability = useCallback(
    async (roomId: string, startDate: string, endDate: string) => {
      patchRoomState(roomId, { isLoading: true, feedback: "" });

      try {
        const availability = await refreshRoomAvailability(hotelId, roomId, startDate, endDate);
        patchRoomState(roomId, {
          startDate,
          endDate,
          availability,
          isLoading: false,
        });
      } catch (error) {
        patchRoomState(roomId, {
          availability: [],
          isLoading: false,
          feedbackType: "error",
          feedback:
            error instanceof Error ? error.message : "Não foi possível carregar a disponibilidade.",
        });
      }
    },
    [hotelId, patchRoomState]
  );

  const handleToggleCalendar = useCallback(
    (roomId: string) => {
      const state = getRoomState(roomId);
      const nextIsOpen = !state.isOpen;

      patchRoomState(roomId, { isOpen: nextIsOpen, feedback: "" });

      if (nextIsOpen && state.availability.length === 0) {
        void loadRoomAvailability(roomId, state.startDate, state.endDate);
      }
    },
    [getRoomState, loadRoomAvailability, patchRoomState]
  );

  const handleVisibleRangeChange = useCallback(
    (roomId: string, startDate: string, endDate: string) => {
      const state = getRoomState(roomId);

      if (state.startDate === startDate && state.endDate === endDate) {
        return;
      }

      void loadRoomAvailability(roomId, startDate, endDate);
    },
    [getRoomState, loadRoomAvailability]
  );

  const handleCalendarSave = useCallback(
    async (payload: CalendarSavePayload): Promise<RoomAvailabilityActionState> => {
      if (getDateRangeDays(payload.startDate, payload.endDate) > MAX_RANGE_DAYS) {
        const errorResult = {
          status: "error" as const,
          message: "Selecione um período de até 180 dias.",
        };

        patchRoomState(payload.roomId, {
          feedbackType: "error",
          feedback: errorResult.message,
        });

        return errorResult;
      }

      const result = await saveRoomAvailabilityRangeAction(hotelId, payload.roomId, payload);

      if (result.status === "success") {
        const state = getRoomState(payload.roomId);
        const availability = await refreshRoomAvailability(
          hotelId,
          payload.roomId,
          state.startDate,
          state.endDate
        );

        patchRoomState(payload.roomId, {
          availability,
          feedbackType: "success",
          feedback: getAvailabilitySuccessMessage(payload),
        });
      } else {
        patchRoomState(payload.roomId, {
          feedbackType: "error",
          feedback: result.message || "Não foi possível salvar a disponibilidade.",
        });
      }

      return result;
    },
    [getRoomState, hotelId, patchRoomState]
  );

  return (
    <section className="hotel-content-card admin-form-section admin-availability-section">
      <div className="admin-rooms-header">
        <div className="section-heading admin-subsection-heading">
          <h2>Disponibilidade</h2>
          <p className="admin-rooms-copy">
            Controle a disponibilidade de cada quarto pelo calendário. Selecione a data inicial e
            final do período.
          </p>
        </div>
      </div>

      {roomCards.length === 0 ? (
        <div className="hotel-empty-state admin-history-empty">
          <strong>Nenhum quarto cadastrado.</strong>
          <p>Cadastre um quarto antes de definir disponibilidade.</p>
        </div>
      ) : (
        <div className="admin-availability-room-list">
          {roomCards.map((room) => {
            const state = getRoomState(room.id);
            const capacityLabel =
              room.capacityAdults || room.capacityChildren
                ? `${room.capacityAdults} adulto${room.capacityAdults === 1 ? "" : "s"} · ${
                    room.capacityChildren
                  } criança${room.capacityChildren === 1 ? "" : "s"}`
                : `${room.capacity} hóspede${room.capacity === 1 ? "" : "s"}`;

            return (
              <article className="admin-availability-room-card" key={room.id}>
                <div className="admin-availability-room-card__header">
                  <div>
                    <strong>{room.name}</strong>
                    <p>{capacityLabel}</p>
                    <small>
                      {getRoomSummary(state.availability, state.startDate, state.endDate)}
                    </small>
                  </div>
                  <div className="admin-availability-room-card__actions">
                    <span
                      className={`admin-room-badge ${room.isActive ? "is-active" : "is-inactive"}`}
                    >
                      {room.isActive ? "Ativo" : "Inativo"}
                    </span>
                    <button
                      type="button"
                      className="admin-secondary-button"
                      onClick={() => handleToggleCalendar(room.id)}
                    >
                      {state.isOpen ? "Fechar calendário" : "Abrir calendário"}
                    </button>
                  </div>
                </div>

                {state.isOpen ? (
                  <div className="admin-availability-room-card__calendar">
                    <p className="admin-availability-room-card__hint">
                      Controle a disponibilidade deste quarto pelo calendário.
                    </p>
                    {state.isLoading ? (
                      <div className="hotel-empty-state admin-history-empty">
                        <strong>Carregando disponibilidade...</strong>
                        <p>Aguarde enquanto o mês selecionado é consultado.</p>
                      </div>
                    ) : null}
                    <RoomAvailabilityCalendar
                      hotelId={hotelId}
                      roomId={room.id}
                      roomName={room.name}
                      availability={state.availability}
                      onVisibleRangeChange={(startDate, endDate) =>
                        handleVisibleRangeChange(room.id, startDate, endDate)
                      }
                      onSavePeriod={handleCalendarSave}
                    />
                    {state.feedback ? (
                      <p
                        className={`admin-editor-feedback ${
                          state.feedbackType === "success" ? "is-success" : "is-error"
                        }`}
                        role={state.feedbackType === "error" ? "alert" : "status"}
                      >
                        {state.feedback}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
