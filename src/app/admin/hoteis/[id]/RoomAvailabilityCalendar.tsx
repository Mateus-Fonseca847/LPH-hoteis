"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import type {
  AuthorizedRoomAvailability,
  RoomAvailabilityActionState,
} from "./room-availability-actions";
import {
  buildCalendarSavePayload,
  DAY_MS,
  formatCalendarDate,
  getCalendarDays,
  getMonthRange,
  resolveAvailabilityStatus,
  selectCalendarRange,
  shiftCalendarMonth,
  toUtcDate,
  type AvailabilityMode,
  type CalendarSavePayload,
} from "./RoomAvailabilityCalendarLogic";

type RoomAvailabilityCalendarProps = {
  hotelId: string;
  roomId: string;
  roomName: string;
  availability: AuthorizedRoomAvailability[];
  onVisibleRangeChange?: (startDate: string, endDate: string) => void;
  onSavePeriod: (payload: CalendarSavePayload) => Promise<RoomAvailabilityActionState>;
  initialMonth?: string;
  today?: string;
};

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];

function getInitialMonth(initialMonth?: string) {
  return initialMonth ?? new Date().toISOString().slice(0, 7);
}

function isInSelectedRange(
  date: string,
  selectedRange: { startDate: string | null; endDate: string | null }
) {
  if (!selectedRange.startDate) {
    return false;
  }

  const endDate = selectedRange.endDate ?? selectedRange.startDate;
  return date >= selectedRange.startDate && date <= endDate;
}

function getRangeDayCount(startDate: string, endDate: string) {
  return Math.floor((toUtcDate(endDate).getTime() - toUtcDate(startDate).getTime()) / DAY_MS) + 1;
}

function getSuccessMessage(mode: AvailabilityMode) {
  if (mode === "occupied") {
    return "Período marcado como ocupado.";
  }

  if (mode === "closed") {
    return "Período fechado para reservas.";
  }

  return "Período liberado para reservas.";
}

export function RoomAvailabilityCalendar({
  hotelId,
  roomId,
  roomName,
  availability,
  onVisibleRangeChange,
  onSavePeriod,
  initialMonth,
  today = new Date().toISOString().slice(0, 10),
}: RoomAvailabilityCalendarProps) {
  const [visibleMonth, setVisibleMonth] = useState(() => getInitialMonth(initialMonth));
  const [selectedRange, setSelectedRange] = useState<{
    startDate: string | null;
    endDate: string | null;
  }>({ startDate: null, endDate: null });
  const [totalUnits, setTotalUnits] = useState("1");
  const [availableUnits, setAvailableUnits] = useState("1");
  const [closed, setClosed] = useState(false);
  const [note, setNote] = useState("");
  const [mode, setMode] = useState<AvailabilityMode>("available");
  const [feedback, setFeedback] = useState("");
  const [feedbackType, setFeedbackType] = useState<"success" | "error">("success");
  const [isPending, startTransition] = useTransition();

  const availabilityByDate = useMemo(
    () => new Map(availability.map((entry) => [entry.date, entry])),
    [availability]
  );
  const calendarDays = useMemo(() => getCalendarDays(visibleMonth), [visibleMonth]);
  const monthLabel = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(toUtcDate(`${visibleMonth}-01`));
  const completedStartDate = selectedRange.startDate;
  const completedEndDate = selectedRange.endDate;
  const hasCompleteRange = Boolean(completedStartDate && completedEndDate);
  const selectedDayCount =
    completedStartDate && completedEndDate
      ? getRangeDayCount(completedStartDate, completedEndDate)
      : 0;
  const isRangeTooLong = selectedDayCount > 180;

  useEffect(() => {
    const range = getMonthRange(visibleMonth);
    onVisibleRangeChange?.(range.startDate, range.endDate);
  }, [onVisibleRangeChange, visibleMonth]);

  const handleMonthChange = (offset: number) => {
    setVisibleMonth((current) => shiftCalendarMonth(current, offset));
  };

  const handleDaySelect = (date: string) => {
    setSelectedRange((current) => selectCalendarRange(current, date));
    setFeedback("");
  };

  const applyMode = (nextMode: AvailabilityMode) => {
    setMode(nextMode);

    if (nextMode === "available") {
      setClosed(false);
      setTotalUnits((current) => (Number(current) > 0 ? current : "1"));
      setAvailableUnits((current) => (Number(current) > 0 ? current : "1"));
      return;
    }

    if (nextMode === "occupied") {
      setClosed(false);
      setAvailableUnits("0");
      return;
    }

    setClosed(true);
    setAvailableUnits("0");
  };

  const handleSave = () => {
    if (!completedStartDate || !completedEndDate) {
      setFeedbackType("error");
      setFeedback("Selecione uma data inicial e uma data final.");
      return;
    }

    if (isRangeTooLong) {
      setFeedbackType("error");
      setFeedback("Selecione um período de até 180 dias.");
      return;
    }

    const payload = buildCalendarSavePayload({
      roomId,
      startDate: completedStartDate,
      endDate: completedEndDate,
      mode,
      totalUnits: Number(totalUnits),
      availableUnits: Number(availableUnits),
      closed,
      note,
    });

    setFeedback("");

    startTransition(async () => {
      const result = await onSavePeriod(payload);
      setFeedbackType(result.status === "success" ? "success" : "error");
      setFeedback(
        result.status === "success"
          ? getSuccessMessage(mode)
          : result.message || "Não foi possível salvar a disponibilidade."
      );
    });
  };

  return (
    <div className="room-availability-calendar" data-hotel-id={hotelId} data-room-id={roomId}>
      <div className="room-availability-calendar__header">
        <div>
          <span>Calendário do quarto</span>
          <strong>{roomName}</strong>
        </div>
        <div className="room-availability-calendar__nav" aria-label="Navegação de mês">
          <button type="button" onClick={() => handleMonthChange(-1)} disabled={isPending}>
            Mês anterior
          </button>
          <strong>{monthLabel}</strong>
          <button type="button" onClick={() => handleMonthChange(1)} disabled={isPending}>
            Próximo mês
          </button>
        </div>
      </div>

      <div className="room-availability-calendar__legend" aria-label="Legenda de disponibilidade">
        <span className="is-empty">Sem cadastro</span>
        <span className="is-available">Disponível</span>
        <span className="is-occupied">Ocupado</span>
        <span className="is-closed">Fechado</span>
        <span className="is-selected">Selecionado</span>
      </div>

      <div className="room-availability-calendar__grid" role="grid" aria-label={monthLabel}>
        {WEEKDAY_LABELS.map((label) => (
          <span key={label} className="room-availability-calendar__weekday">
            {label}
          </span>
        ))}
        {calendarDays.map((day) => {
          const entry = availabilityByDate.get(day.date);
          const status = resolveAvailabilityStatus(entry);
          const isSelected = isInSelectedRange(day.date, selectedRange);
          const className = [
            "room-availability-calendar__day",
            `is-${status}`,
            day.inMonth ? "" : "is-outside-month",
            day.date === today ? "is-today" : "",
            isSelected ? "is-selected" : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <button
              key={day.date}
              type="button"
              className={className}
              onClick={() => handleDaySelect(day.date)}
              aria-pressed={isSelected}
            >
              <span>{Number(day.date.slice(8, 10))}</span>
              <small>
                {status === "available"
                  ? `${entry?.availableUnits}/${entry?.totalUnits}`
                  : status === "occupied"
                    ? "0 un."
                    : status === "closed"
                      ? "Fechado"
                      : "Sem cadastro"}
              </small>
            </button>
          );
        })}
      </div>

      {completedStartDate ? (
        <p className="room-availability-calendar__selection" role="status">
          Período selecionado: {formatCalendarDate(completedStartDate)} até{" "}
          {formatCalendarDate(completedEndDate ?? completedStartDate)}
        </p>
      ) : null}

      {hasCompleteRange ? (
        <div className="room-availability-calendar__panel">
          <div className="room-availability-calendar__quick-actions">
            <button
              type="button"
              className={mode === "available" ? "is-active" : ""}
              onClick={() => applyMode("available")}
            >
              Liberar período
            </button>
            <button
              type="button"
              className={mode === "occupied" ? "is-active" : ""}
              onClick={() => applyMode("occupied")}
            >
              Marcar como ocupado
            </button>
            <button
              type="button"
              className={mode === "closed" ? "is-active" : ""}
              onClick={() => applyMode("closed")}
            >
              Fechar período
            </button>
          </div>

          <div className="admin-form-grid admin-form-grid--three">
            <label className="admin-form-field">
              <span>Unidades totais</span>
              <input
                type="number"
                min="0"
                value={totalUnits}
                onChange={(event) => setTotalUnits(event.target.value)}
              />
            </label>
            <label className="admin-form-field">
              <span>Unidades disponíveis</span>
              <input
                type="number"
                min="0"
                value={availableUnits}
                onChange={(event) => setAvailableUnits(event.target.value)}
              />
            </label>
            <label className="admin-toggle-field admin-toggle-field--boxed">
              <input
                type="checkbox"
                checked={closed}
                onChange={(event) => setClosed(event.target.checked)}
              />
              <span>Fechado no período</span>
            </label>
            <label className="admin-form-field admin-form-field--full">
              <span>Observação interna</span>
              <textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} />
            </label>
          </div>

          <div className="room-availability-calendar__footer">
            <span>
              {selectedDayCount} dia{selectedDayCount > 1 ? "s" : ""}
            </span>
            <button
              type="button"
              className="card-cta-button admin-edit-button"
              onClick={handleSave}
              disabled={isPending}
            >
              {isPending ? "Salvando..." : "Salvar período"}
            </button>
          </div>
          {isRangeTooLong ? (
            <p className="admin-form-error admin-form-error--block">
              Selecione um período de até 180 dias.
            </p>
          ) : null}
        </div>
      ) : null}

      {feedback ? (
        <p
          className={`admin-editor-feedback ${feedbackType === "success" ? "is-success" : "is-error"}`}
          role={feedbackType === "error" ? "alert" : "status"}
        >
          {feedback}
        </p>
      ) : null}
    </div>
  );
}
