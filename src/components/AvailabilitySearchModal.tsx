"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
  getCompatibleRoomAvailabilityResults,
  type AvailabilityResultRoom,
} from "@/lib/availability-results";
import { formatPriceInBRL } from "@/lib/stay-query";

type AvailabilitySearchModalProps = {
  hotelName: string;
  hotelEmail: string;
  hotelWhatsapp: string;
  roomName?: string;
  rooms: AvailabilityResultRoom[];
  onClose: () => void;
};

const MIN_ADULTS = 1;
const MAX_ADULTS = 10;
const MIN_CHILDREN = 0;
const MAX_CHILDREN = 10;
const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];

type TravelerStepperProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
};

type AvailabilityFlowStepperProps = {
  currentStep: AvailabilityFlowStep;
  onBackToSearch: () => void;
};

type AvailabilityFlowStep = 1 | 2 | 3;

const AVAILABILITY_FLOW_STEPS = ["Datas e viajantes", "Escolha do quarto", "Confirmação"] as const;
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function isSameDay(left: Date | null, right: Date | null) {
  return Boolean(
    left &&
    right &&
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function isBeforeDay(left: Date, right: Date) {
  return startOfDay(left).getTime() < startOfDay(right).getTime();
}

function isAfterDay(left: Date, right: Date) {
  return startOfDay(left).getTime() > startOfDay(right).getTime();
}

function isBetweenDays(date: Date, start: Date | null, end: Date | null) {
  return Boolean(start && end && isAfterDay(date, start) && isBeforeDay(date, end));
}

function getMonthDays(month: Date) {
  const firstDay = startOfMonth(month);
  const daysInMonth = new Date(firstDay.getFullYear(), firstDay.getMonth() + 1, 0).getDate();
  const leadingBlanks = firstDay.getDay();
  const days: Array<Date | null> = Array.from({ length: leadingBlanks }, () => null);

  for (let day = 1; day <= daysInMonth; day += 1) {
    days.push(new Date(firstDay.getFullYear(), firstDay.getMonth(), day));
  }

  return days;
}

function formatMonthLabel(month: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(month);
}

function formatDateLabel(date: Date | null) {
  if (!date) {
    return "Nao selecionado";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDateShort(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

function getNights(checkIn: Date | null, checkOut: Date | null) {
  if (!checkIn || !checkOut || !isAfterDay(checkOut, checkIn)) {
    return 0;
  }

  return Math.round((startOfDay(checkOut).getTime() - startOfDay(checkIn).getTime()) / 86400000);
}

function buildStayContactMessage({
  hotelName,
  roomName,
  checkIn,
  checkOut,
  nights,
  adults,
  children,
  totalPriceCents,
}: {
  hotelName: string;
  roomName: string;
  checkIn: Date;
  checkOut: Date;
  nights: number;
  adults: number;
  children: number;
  totalPriceCents?: number;
}) {
  const childrenText =
    children > 0 ? ` e ${children} ${children === 1 ? "crianca" : "criancas"}` : "";
  const priceText =
    typeof totalPriceCents === "number"
      ? ` Valor estimado: ${formatPriceInBRL(totalPriceCents)}.`
      : "";

  return (
    `Ola! Gostaria de consultar disponibilidade no ${hotelName}` +
    ` para o quarto ${roomName}, de ${formatDateShort(checkIn)} a ${formatDateShort(checkOut)}` +
    ` (${nights} ${nights === 1 ? "noite" : "noites"}), para ${adults} ${
      adults === 1 ? "adulto" : "adultos"
    }${childrenText}.` +
    priceText +
    " Poderiam confirmar a disponibilidade? Entendo que a reserva ainda precisa ser confirmada pela equipe."
  );
}

function buildWhatsAppHref(phone: string, message: string) {
  const digits = phone.replace(/\D/g, "");

  return digits ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}` : null;
}

function buildEmailHref(email: string, hotelName: string, message: string) {
  if (!email.trim()) {
    return null;
  }

  const subject = `Consulta de disponibilidade - ${hotelName}`;

  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(
    message
  )}`;
}

function TravelerStepper({ label, value, min, max, onChange }: TravelerStepperProps) {
  const labelId = useId();

  return (
    <div className="availability-traveler-stepper">
      <span id={labelId}>{label}</span>
      <div
        className="availability-traveler-stepper-controls"
        role="group"
        aria-labelledby={labelId}
      >
        <button
          type="button"
          onClick={() => onChange(clamp(value - 1, min, max))}
          disabled={value <= min}
          aria-label={`Diminuir ${label.toLowerCase()}`}
        >
          -
        </button>
        <strong aria-live="polite">{value}</strong>
        <button
          type="button"
          onClick={() => onChange(clamp(value + 1, min, max))}
          disabled={value >= max}
          aria-label={`Aumentar ${label.toLowerCase()}`}
        >
          +
        </button>
      </div>
    </div>
  );
}

function AvailabilityFlowStepper({ currentStep, onBackToSearch }: AvailabilityFlowStepperProps) {
  return (
    <nav className="availability-flow-stepper" aria-label="Etapas da consulta">
      <ol>
        {AVAILABILITY_FLOW_STEPS.map((label, index) => {
          const stepNumber = index + 1;
          const isCurrent = stepNumber === currentStep;
          const isCompleted = stepNumber < currentStep;
          const isFuture = stepNumber > currentStep;
          const canReturnToSearch = stepNumber === 1 && currentStep > 1;
          const stepClassName = [
            "availability-flow-step",
            isCurrent ? "is-current" : "",
            isCompleted ? "is-completed" : "",
            isFuture ? "is-future" : "",
          ]
            .filter(Boolean)
            .join(" ");
          const content = (
            <>
              <span className="availability-flow-step__marker">
                {isCompleted ? "OK" : stepNumber}
              </span>
              <span className="availability-flow-step__label">{label}</span>
            </>
          );

          return (
            <li key={label} className={stepClassName}>
              {canReturnToSearch ? (
                <button
                  type="button"
                  onClick={onBackToSearch}
                  aria-label="Voltar para Datas e viajantes"
                >
                  {content}
                </button>
              ) : (
                <span aria-current={isCurrent ? "step" : undefined}>{content}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function AvailabilitySearchModal({
  hotelName,
  hotelEmail,
  hotelWhatsapp,
  roomName,
  rooms,
  onClose,
}: AvailabilitySearchModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const modalRef = useRef<HTMLElement | null>(null);
  const context = roomName ? ` para ${roomName}` : "";
  const today = startOfDay(new Date());
  const [adults, setAdults] = useState(MIN_ADULTS);
  const [children, setChildren] = useState(MIN_CHILDREN);
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(today));
  const [checkIn, setCheckIn] = useState<Date | null>(null);
  const [checkOut, setCheckOut] = useState<Date | null>(null);
  const [currentStep, setCurrentStep] = useState<AvailabilityFlowStep>(1);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const canGoToPreviousMonth = startOfMonth(visibleMonth).getTime() > startOfMonth(today).getTime();
  const monthDays = getMonthDays(visibleMonth);
  const nights = getNights(checkIn, checkOut);
  const hasValidStay = Boolean(checkIn && checkOut && nights > 0 && adults >= MIN_ADULTS);
  const roomResults =
    currentStep > 1 && checkIn && checkOut
      ? getCompatibleRoomAvailabilityResults({
          rooms,
          checkIn: formatDateInput(checkIn),
          checkOut: formatDateInput(checkOut),
          adults,
          children,
        })
      : [];
  const selectedRoomResult = roomResults.find(({ room }) => room.id === selectedRoomId) ?? null;
  const validationMessage = !checkIn
    ? "Selecione a data de check-in para continuar."
    : !checkOut
      ? "Selecione a data de check-out para continuar."
      : nights <= 0
        ? "O check-out deve ser posterior ao check-in."
        : adults < MIN_ADULTS
          ? "Informe pelo menos 1 adulto."
          : "";
  const selectedRoomContactMessage =
    selectedRoomResult && checkIn && checkOut
      ? buildStayContactMessage({
          hotelName,
          roomName: selectedRoomResult.room.name,
          checkIn,
          checkOut,
          nights,
          adults,
          children,
          totalPriceCents: selectedRoomResult.priceEstimate?.totalPriceCents,
        })
      : null;
  const selectedRoomWhatsappHref = selectedRoomContactMessage
    ? buildWhatsAppHref(hotelWhatsapp, selectedRoomContactMessage)
    : null;

  useEffect(() => {
    const previouslyFocusedElement =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    modalRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key !== "Tab" || !modalRef.current) {
        return;
      }

      const focusableElements = Array.from(
        modalRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter(
        (element) =>
          !element.hasAttribute("disabled") &&
          element.getAttribute("aria-hidden") !== "true" &&
          element.offsetParent !== null
      );

      if (!focusableElements.length) {
        event.preventDefault();
        modalRef.current.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;

      if (!(activeElement instanceof Node) || !modalRef.current.contains(activeElement)) {
        event.preventDefault();
        firstElement.focus();
        return;
      }

      if (activeElement === modalRef.current) {
        event.preventDefault();
        (event.shiftKey ? lastElement : firstElement).focus();
        return;
      }

      if (event.shiftKey && activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
        return;
      }

      if (!event.shiftKey && activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocusedElement?.focus();
    };
  }, [onClose]);

  function handleDateClick(date: Date) {
    if (isBeforeDay(date, today)) {
      return;
    }

    if (!checkIn || checkOut || !isAfterDay(date, checkIn)) {
      setCheckIn(date);
      setCheckOut(null);
      setCurrentStep(1);
      setSelectedRoomId(null);
      return;
    }

    setCheckOut(date);
    setCurrentStep(1);
    setSelectedRoomId(null);
  }

  function handleProceed() {
    if (!hasValidStay) {
      return;
    }

    setCurrentStep(2);
  }

  function handlePreviousStep() {
    if (currentStep === 2) {
      setCurrentStep(1);
      return;
    }

    if (currentStep === 3) {
      setCurrentStep(2);
    }
  }

  const modalContent = (
    <div className="hotel-availability-modal-backdrop" role="presentation">
      <section
        ref={modalRef}
        className="hotel-availability-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
      >
        <header className="hotel-availability-modal-header">
          <div>
            <span className="hotel-page-eyebrow">Disponibilidade</span>
            <h2 id={titleId}>Consultar disponibilidade</h2>
            <p id={descriptionId}>
              Selecione o periodo e os viajantes para consultar opcoes no {hotelName}
              {context}.
            </p>
          </div>

          <button
            type="button"
            className="hotel-availability-modal-close"
            onClick={onClose}
            aria-label="Fechar consulta de disponibilidade"
          >
            X
          </button>
        </header>

        <div className="availability-flow-navigation">
          {currentStep > 1 ? (
            <button
              type="button"
              className="availability-previous-step-button"
              onClick={handlePreviousStep}
              aria-label="Voltar para etapa anterior"
            >
              <span aria-hidden="true">&lt;</span>
              <span>Voltar</span>
            </button>
          ) : null}

          <AvailabilityFlowStepper
            currentStep={currentStep}
            onBackToSearch={() => setCurrentStep(1)}
          />
        </div>

        {currentStep === 1 ? (
          <div className="availability-search-modal-grid">
            <section className="availability-search-modal-panel">
              <div className="availability-search-modal-panel-heading">
                <h3>Viajantes</h3>
                <span>Adultos e criancas</span>
              </div>
              <div className="availability-traveler-list">
                <TravelerStepper
                  label="Adultos"
                  value={adults}
                  min={MIN_ADULTS}
                  max={MAX_ADULTS}
                  onChange={setAdults}
                />
                <TravelerStepper
                  label="Criancas"
                  value={children}
                  min={MIN_CHILDREN}
                  max={MAX_CHILDREN}
                  onChange={setChildren}
                />
              </div>

              <div className="availability-search-modal-panel-heading">
                <h3>Periodo</h3>
                <span>Escolha check-in e check-out</span>
              </div>
              <div className="availability-calendar">
                <div className="availability-calendar-toolbar">
                  <button
                    type="button"
                    onClick={() => setVisibleMonth((current) => addMonths(current, -1))}
                    disabled={!canGoToPreviousMonth}
                    aria-label="Mes anterior"
                  >
                    Anterior
                  </button>
                  <strong>{formatMonthLabel(visibleMonth)}</strong>
                  <button
                    type="button"
                    onClick={() => setVisibleMonth((current) => addMonths(current, 1))}
                    aria-label="Proximo mes"
                  >
                    Proximo
                  </button>
                </div>

                <div className="availability-calendar-weekdays" aria-hidden="true">
                  {WEEKDAYS.map((weekday) => (
                    <span key={weekday}>{weekday}</span>
                  ))}
                </div>

                <div className="availability-calendar-grid">
                  {monthDays.map((date, index) =>
                    date ? (
                      <button
                        key={date.toISOString()}
                        type="button"
                        className={[
                          "availability-calendar-day",
                          isSameDay(date, today) ? "is-today" : "",
                          isSameDay(date, checkIn) ? "is-selected" : "",
                          isSameDay(date, checkOut) ? "is-selected" : "",
                          isBetweenDays(date, checkIn, checkOut) ? "is-in-range" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        onClick={() => handleDateClick(date)}
                        disabled={isBeforeDay(date, today)}
                        aria-pressed={isSameDay(date, checkIn) || isSameDay(date, checkOut)}
                        aria-label={new Intl.DateTimeFormat("pt-BR", {
                          dateStyle: "full",
                        }).format(date)}
                      >
                        {date.getDate()}
                      </button>
                    ) : (
                      <span key={`blank-${index}`} className="availability-calendar-day-spacer" />
                    )
                  )}
                </div>
              </div>
            </section>

            <aside className="availability-search-modal-side">
              <section className="availability-search-modal-panel">
                <div className="availability-search-modal-panel-heading">
                  <h3>Resumo</h3>
                  <span>Selecao atual</span>
                </div>
                <div className="availability-traveler-summary">
                  <div>
                    <span>Check-in</span>
                    <strong>{formatDateLabel(checkIn)}</strong>
                  </div>
                  <div>
                    <span>Check-out</span>
                    <strong>{formatDateLabel(checkOut)}</strong>
                  </div>
                  <div>
                    <span>Adultos</span>
                    <strong>{adults}</strong>
                  </div>
                  <div>
                    <span>Criancas</span>
                    <strong>{children}</strong>
                  </div>
                </div>
              </section>

              <button
                type="button"
                className="card-cta-button availability-proceed-button"
                onClick={handleProceed}
                disabled={!hasValidStay}
              >
                Prosseguir
              </button>

              {validationMessage ? (
                <p className="availability-search-validation-message">{validationMessage}</p>
              ) : null}
            </aside>
          </div>
        ) : currentStep === 2 && checkIn && checkOut ? (
          <section className="availability-room-choice-step">
            <div className="availability-results-header">
              <div className="availability-search-modal-panel-heading">
                <h3>Escolha seu quarto</h3>
                <span>Quartos compativeis com sua busca</span>
              </div>
            </div>

            <div className="availability-results-summary">
              <div>
                <span>Check-in</span>
                <strong>{formatDateLabel(checkIn)}</strong>
              </div>
              <div>
                <span>Check-out</span>
                <strong>{formatDateLabel(checkOut)}</strong>
              </div>
              <div>
                <span>Noites</span>
                <strong>{nights}</strong>
              </div>
              <div>
                <span>Adultos</span>
                <strong>{adults}</strong>
              </div>
              <div>
                <span>Criancas</span>
                <strong>{children}</strong>
              </div>
            </div>

            {roomResults.length ? (
              <div className="availability-modal-room-list">
                {roomResults.map(({ room, availabilityStatus, priceEstimate, capacityLabel }) => {
                  const contactMessage = buildStayContactMessage({
                    hotelName,
                    roomName: room.name,
                    checkIn,
                    checkOut,
                    nights,
                    adults,
                    children,
                    totalPriceCents: priceEstimate?.totalPriceCents,
                  });
                  const whatsappHref = buildWhatsAppHref(hotelWhatsapp, contactMessage);
                  const emailHref = buildEmailHref(hotelEmail, hotelName, contactMessage);
                  const fallbackHref = whatsappHref ?? emailHref;
                  const fallbackLabel = whatsappHref
                    ? "Consultar pelo WhatsApp"
                    : "Consultar por e-mail";
                  const statusLabel =
                    availabilityStatus === "available"
                      ? "Disponivel"
                      : availabilityStatus === "unavailable"
                        ? "Indisponivel"
                        : "Consultar disponibilidade";

                  return (
                    <article
                      key={room.id}
                      className={[
                        "availability-modal-room-card",
                        selectedRoomId === room.id ? "is-selected" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      <div className="availability-modal-room-card__media">
                        <Image
                          src={room.imageUrl}
                          alt={`Quarto ${room.name}`}
                          fill
                          sizes="(max-width: 560px) 100vw, 180px"
                          unoptimized
                        />
                      </div>
                      <div className="availability-modal-room-card__content">
                        <div className="availability-modal-room-card__header">
                          <h3>{room.name}</h3>
                          <span
                            className={`hotel-room-badge ${
                              availabilityStatus === "available"
                                ? "is-available"
                                : availabilityStatus === "unavailable"
                                  ? "is-unavailable"
                                  : ""
                            }`}
                          >
                            {statusLabel}
                          </span>
                        </div>
                        <p className="availability-modal-room-card__description">
                          {room.description}
                        </p>
                        <div className="hotel-room-meta availability-modal-room-card__meta">
                          <span>{capacityLabel}</span>
                          <span>{room.beds}</span>
                          <span>{room.sizeM2 ? `${room.sizeM2} m2` : room.size}</span>
                        </div>
                        {room.amenities.length ? (
                          <div className="availability-modal-room-card__amenities">
                            {room.amenities.slice(0, 4).map((amenity) => (
                              <span key={`${room.id}-${amenity}`}>{amenity}</span>
                            ))}
                          </div>
                        ) : null}
                        <div className="availability-modal-room-card__footer">
                          <div>
                            <strong>
                              {priceEstimate
                                ? `${formatPriceInBRL(priceEstimate.nightlyPriceCents)} / noite`
                                : room.lowestActiveRateCents
                                  ? `A partir de ${formatPriceInBRL(room.lowestActiveRateCents)}`
                                  : "Consultar valores"}
                            </strong>
                            <span>
                              {priceEstimate
                                ? `Total estimado: ${formatPriceInBRL(
                                    priceEstimate.totalPriceCents
                                  )}`
                                : "Valores sujeitos a confirmacao pela equipe."}
                            </span>
                          </div>

                          {availabilityStatus === "available" ? (
                            <button
                              type="button"
                              className="availability-modal-room-card__cta"
                              onClick={() => {
                                setSelectedRoomId(room.id);
                                setCurrentStep(3);
                              }}
                            >
                              Selecionar quarto
                            </button>
                          ) : availabilityStatus === "unknown" && fallbackHref ? (
                            <a
                              href={fallbackHref}
                              className="availability-modal-room-card__cta"
                              target="_blank"
                              rel="noreferrer"
                            >
                              {fallbackLabel}
                            </a>
                          ) : (
                            <span className="availability-modal-room-card__cta is-disabled">
                              {availabilityStatus === "unavailable"
                                ? "Indisponivel"
                                : "Contato indisponivel"}
                            </span>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="hotel-empty-state availability-modal-empty">
                <strong>Nenhum quarto comporta essa ocupacao.</strong>
                <p>Reduza o numero de viajantes ou consulte a equipe para alternativas.</p>
              </div>
            )}
          </section>
        ) : currentStep === 3 && checkIn && checkOut && selectedRoomResult ? (
          <section className="availability-confirmation-step">
            <div className="availability-results-header">
              <div className="availability-search-modal-panel-heading">
                <h3>Confirmação</h3>
                <span>Revise os dados antes de continuar pelo WhatsApp</span>
              </div>
            </div>

            <div className="availability-confirmation-card">
              <div className="availability-confirmation-room">
                <div className="availability-confirmation-room__media">
                  <Image
                    src={selectedRoomResult.room.imageUrl}
                    alt={`Quarto ${selectedRoomResult.room.name}`}
                    fill
                    sizes="(max-width: 560px) 100vw, 220px"
                    unoptimized
                  />
                </div>
                <div>
                  <span>Quarto selecionado</span>
                  <strong>{selectedRoomResult.room.name}</strong>
                  <p>{selectedRoomResult.room.description}</p>
                </div>
              </div>

              <div className="availability-confirmation-details">
                <div>
                  <span>Hotel</span>
                  <strong>{hotelName}</strong>
                </div>
                <div>
                  <span>Check-in</span>
                  <strong>{formatDateLabel(checkIn)}</strong>
                </div>
                <div>
                  <span>Check-out</span>
                  <strong>{formatDateLabel(checkOut)}</strong>
                </div>
                <div>
                  <span>Noites</span>
                  <strong>{nights}</strong>
                </div>
                <div>
                  <span>Adultos</span>
                  <strong>{adults}</strong>
                </div>
                <div>
                  <span>Crianças</span>
                  <strong>{children}</strong>
                </div>
                {selectedRoomResult.priceEstimate ? (
                  <>
                    <div>
                      <span>Preço por noite</span>
                      <strong>
                        {formatPriceInBRL(selectedRoomResult.priceEstimate.nightlyPriceCents)}
                      </strong>
                    </div>
                    <div>
                      <span>Total estimado</span>
                      <strong>
                        {formatPriceInBRL(selectedRoomResult.priceEstimate.totalPriceCents)}
                      </strong>
                    </div>
                  </>
                ) : null}
              </div>

              <p className="availability-confirmation-notice">
                A reserva ainda será confirmada pela equipe do hotel.
              </p>

              {selectedRoomWhatsappHref ? (
                <a
                  href={selectedRoomWhatsappHref}
                  className="availability-confirmation-cta"
                  target="_blank"
                  rel="noreferrer"
                >
                  Continuar pelo WhatsApp
                </a>
              ) : (
                <span className="availability-confirmation-cta is-disabled">
                  WhatsApp indisponivel
                </span>
              )}
            </div>
          </section>
        ) : (
          <section className="availability-search-results-placeholder">
            <div className="hotel-empty-state availability-modal-empty">
              <strong>Complete os dados da busca para continuar.</strong>
              <p>{validationMessage || "Volte para selecionar datas e viajantes."}</p>
            </div>
          </section>
        )}
      </section>
    </div>
  );

  return createPortal(modalContent, document.body);
}
