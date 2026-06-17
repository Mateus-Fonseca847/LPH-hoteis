"use client";

import { useId, useState } from "react";

import { RoomImageCarousel } from "@/components/RoomImageCarousel";
import {
  getCompatibleRoomAvailabilityResults,
  type AvailabilityResultRoom,
} from "@/lib/availability-results";
import { getGuestDocumentError, normalizeGuestDocument } from "@/lib/guest-document";
import { formatPriceInBRL } from "@/lib/stay-query";

type BookingFlowProps = {
  hotelSlug?: string;
  hotelId: string;
  hotelName: string;
  roomName?: string;
  rooms: AvailabilityResultRoom[];
};

type CreateReservationResponse = {
  ok: boolean;
  error?: string;
  reservation?: {
    id: string;
    status: string;
    totalPriceLabel: string;
  };
};

type GuestFormErrors = {
  guestName?: string;
  guestEmail?: string;
  guestPhone?: string;
  guestDocument?: string;
};

type PaymentFormErrors = {
  paymentObservation1?: string;
  paymentObservation2?: string;
  paymentObservation3?: string;
};

type AvailabilityFlowStep = 1 | 2 | 3 | 4 | 5;
type PaymentMethod = "credit_card" | "debit_card";
type PaymentCardBrand =
  | "visa"
  | "mastercard"
  | "elo"
  | "american_express"
  | "hipercard"
  | "diners_club"
  | "outra";

type PaymentOption<T extends string> = {
  value: T;
  label: string;
  description?: string;
};

const MIN_ADULTS = 1;
const MAX_ADULTS = 10;
const MIN_CHILDREN = 0;
const MAX_CHILDREN = 10;
const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];
const PAYMENT_INFO_TEXT =
  "O pagamento será combinado diretamente com o hotel. Registramos apenas sua preferência de cartão e observações para contato.";
const PAYMENT_METHOD_OPTIONS: Array<PaymentOption<PaymentMethod>> = [
  {
    value: "credit_card",
    label: "Cartão de crédito",
  },
  {
    value: "debit_card",
    label: "Cartão de débito",
  },
];
const PAYMENT_CARD_BRAND_OPTIONS: Array<PaymentOption<PaymentCardBrand>> = [
  { value: "visa", label: "Visa" },
  { value: "mastercard", label: "Mastercard" },
  { value: "elo", label: "Elo" },
  { value: "american_express", label: "American Express" },
  { value: "hipercard", label: "Hipercard" },
  { value: "diners_club", label: "Diners Club" },
  { value: "outra", label: "Outra" },
];
const PAYMENT_OBSERVATION_FIELDS = [
  {
    label: "Número do cartão",
    placeholder: "Número do cartão",
  },
  {
    label: "Data de validade",
    placeholder: "MM/AA",
  },
  {
    label: "CVV",
    placeholder: "123",
  },
] as const;

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
    return "Não selecionado";
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

function formatPaymentMethodLabel(method: PaymentMethod | "") {
  return (
    PAYMENT_METHOD_OPTIONS.find((option) => option.value === method)?.label ?? "Não selecionado"
  );
}

function formatPaymentCardBrandLabel(brand: PaymentCardBrand | "") {
  return (
    PAYMENT_CARD_BRAND_OPTIONS.find((option) => option.value === brand)?.label ?? "Não selecionada"
  );
}

function getNights(checkIn: Date | null, checkOut: Date | null) {
  if (!checkIn || !checkOut || !isAfterDay(checkOut, checkIn)) {
    return 0;
  }

  return Math.round((startOfDay(checkOut).getTime() - startOfDay(checkIn).getTime()) / 86400000);
}

function validateGuestData({
  guestName,
  guestEmail,
  guestPhone,
  guestDocument,
}: {
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  guestDocument: string;
}) {
  const errors: GuestFormErrors = {};
  const trimmedName = guestName.trim();
  const trimmedEmail = guestEmail.trim();
  const trimmedPhone = guestPhone.trim();

  if (trimmedName.length < 3) {
    errors.guestName = "Informe o nome completo.";
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    errors.guestEmail = "Informe um e-mail válido.";
  }

  if (trimmedPhone.replace(/\D/g, "").length < 8) {
    errors.guestPhone = "Informe um telefone valido.";
  }

  if (!normalizeGuestDocument(guestDocument)) {
    errors.guestDocument = getGuestDocumentError(guestDocument);
  }

  return errors;
}

function formatPaymentCardNumberInput(value: string) {
  return value
    .replace(/\D/g, "")
    .slice(0, 16)
    .replace(/(\d{4})(?=\d)/g, "$1 ");
}

function formatPaymentExpiryInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 4);

  if (digits.length <= 2) {
    return digits;
  }

  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

function formatPaymentCvvInput(value: string) {
  return value.replace(/\D/g, "").slice(0, 3);
}

function validatePaymentData({
  paymentObservation1,
  paymentObservation2,
  paymentObservation3,
}: {
  paymentObservation1: string;
  paymentObservation2: string;
  paymentObservation3: string;
}) {
  const errors: PaymentFormErrors = {};

  if (!/^\d{4} \d{4} \d{4} \d{4}$/.test(paymentObservation1)) {
    errors.paymentObservation1 = "Informe 16 numeros separados de 4 em 4.";
  }

  if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(paymentObservation2)) {
    errors.paymentObservation2 = "Informe a data no formato MM/AA.";
  }

  if (!/^\d{3}$/.test(paymentObservation3)) {
    errors.paymentObservation3 = "Informe 3 numeros.";
  }

  return errors;
}

function TravelerStepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
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

function AvailabilityFlowStepper({
  currentStep,
  onBackToSearch,
}: {
  currentStep: AvailabilityFlowStep;
  onBackToSearch: () => void;
}) {
  const steps = [
    "Datas e viajantes",
    "Escolha do quarto",
    "Dados do hóspede",
    "Pagamento",
    "Confirmacao",
  ] as const;

  return (
    <nav className="availability-flow-stepper" aria-label="Etapas da consulta">
      <ol>
        {steps.map((label, index) => {
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
                {isCompleted ? <span aria-hidden="true">✓</span> : stepNumber}
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

export function BookingFlow({ hotelSlug, hotelId, hotelName, roomName, rooms }: BookingFlowProps) {
  const titleId = useId();
  const descriptionId = useId();
  const context = roomName ? ` para ${roomName}` : "";
  const today = startOfDay(new Date());
  const [adults, setAdults] = useState(MIN_ADULTS);
  const [children, setChildren] = useState(MIN_CHILDREN);
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(today));
  const [checkIn, setCheckIn] = useState<Date | null>(null);
  const [checkOut, setCheckOut] = useState<Date | null>(null);
  const [currentStep, setCurrentStep] = useState<AvailabilityFlowStep>(1);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestDocument, setGuestDocument] = useState("");
  const [guestDocumentTouched, setGuestDocumentTouched] = useState(false);
  const [guestFormErrors, setGuestFormErrors] = useState<GuestFormErrors>({});
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">("");
  const [paymentCardBrand, setPaymentCardBrand] = useState<PaymentCardBrand | "">("");
  const [paymentObservation1, setPaymentObservation1] = useState("");
  const [paymentObservation2, setPaymentObservation2] = useState("");
  const [paymentObservation3, setPaymentObservation3] = useState("");
  const [paymentFormErrors, setPaymentFormErrors] = useState<PaymentFormErrors>({});
  const [reservationError, setReservationError] = useState("");
  const [createdReservationId, setCreatedReservationId] = useState<string | null>(null);
  const [isSubmittingReservation, setIsSubmittingReservation] = useState(false);
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
  const selectedPriceEstimate = selectedRoomResult?.priceEstimate ?? null;
  const selectedNightlyPriceCents =
    selectedPriceEstimate?.nightlyPriceCents ??
    selectedRoomResult?.room.lowestActiveRateCents ??
    null;
  const selectedTotalPriceCents =
    selectedPriceEstimate?.totalPriceCents ??
    (selectedNightlyPriceCents ? selectedNightlyPriceCents * nights : null);
  const selectedTotalPriceLabel = selectedTotalPriceCents
    ? formatPriceInBRL(selectedTotalPriceCents)
    : "Valor estimado sob consulta";
  const validationMessage = !checkIn
    ? "Selecione a data de check-in para continuar."
    : !checkOut
      ? "Selecione a data de check-out para continuar."
      : nights <= 0
        ? "O check-out deve ser posterior ao check-in."
        : adults < MIN_ADULTS
          ? "Informe pelo menos 1 adulto."
          : "";

  function resetReservationStepState() {
    setSelectedRoomId(null);
    setCreatedReservationId(null);
    setReservationError("");
    setPaymentMethod("");
    setPaymentCardBrand("");
    setPaymentObservation1("");
    setPaymentObservation2("");
    setPaymentObservation3("");
    setPaymentFormErrors({});
  }

  function handleDateClick(date: Date) {
    if (isBeforeDay(date, today)) {
      return;
    }

    if (!checkIn || checkOut || !isAfterDay(date, checkIn)) {
      setCheckIn(date);
      setCheckOut(null);
      setCurrentStep(1);
      resetReservationStepState();
      return;
    }

    setCheckOut(date);
    setCurrentStep(1);
    resetReservationStepState();
  }

  function handleProceed() {
    if (!hasValidStay) {
      return;
    }

    setCurrentStep(2);
  }

  function handleGuestDataProceed() {
    const errors = validateGuestData({
      guestName,
      guestEmail,
      guestPhone,
      guestDocument,
    });

    setGuestFormErrors(errors);
    setGuestDocumentTouched(true);

    if (Object.keys(errors).length > 0) {
      return;
    }

    setReservationError("");
    setCurrentStep(4);
  }

  async function handleReservationSubmit() {
    if (!checkIn || !checkOut || !selectedRoomResult || isSubmittingReservation) {
      return;
    }

    const paymentErrors = validatePaymentData({
      paymentObservation1,
      paymentObservation2,
      paymentObservation3,
    });

    setPaymentFormErrors(paymentErrors);

    if (Object.keys(paymentErrors).length > 0) {
      setReservationError("Verifique os dados do cartao para enviar a solicitacao.");
      return;
    }

    if (!paymentMethod || !paymentCardBrand) {
      setReservationError("Escolha o tipo e a bandeira do cartão para enviar a solicitação.");
      return;
    }

    const errors = validateGuestData({
      guestName,
      guestEmail,
      guestPhone,
      guestDocument,
    });

    setGuestFormErrors(errors);
    setGuestDocumentTouched(true);

    if (Object.keys(errors).length > 0) {
      setCurrentStep(3);
      return;
    }

    setReservationError("");
    setIsSubmittingReservation(true);

    try {
      const response = await fetch("/api/reservas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          hotelId,
          roomId: selectedRoomResult.room.id,
          guestName,
          guestEmail,
          guestPhone,
          guestDocument: normalizeGuestDocument(guestDocument) || guestDocument.trim(),
          checkIn: formatDateInput(checkIn),
          checkOut: formatDateInput(checkOut),
          adults,
          children,
          paymentMethod,
          paymentCardBrand,
          paymentObservation1,
          paymentObservation2,
          paymentObservation3,
        }),
      });
      const payload = (await response.json().catch(() => null)) as CreateReservationResponse | null;

      if (!response.ok || !payload?.ok || !payload.reservation) {
        throw new Error("reservation_request_failed");
      }

      setCreatedReservationId(payload.reservation.id);
      setCurrentStep(5);
    } catch {
      setReservationError(
        "Não foi possível enviar a solicitação de reserva. Verifique os dados e tente novamente."
      );
    } finally {
      setIsSubmittingReservation(false);
    }
  }

  return (
    <section className="booking-flow" aria-labelledby={titleId} aria-describedby={descriptionId}>
      <header className="booking-flow-header">
        <div>
          <h2 id={titleId}>Consultar disponibilidade{context}</h2>
          <p id={descriptionId}>
            Consulte datas, escolha um quarto e envie sua solicitação de reserva. O pagamento será
            combinado diretamente com o {hotelName}.
          </p>
        </div>
      </header>

      <AvailabilityFlowStepper
        currentStep={currentStep}
        onBackToSearch={() => {
          setCurrentStep(1);
          setReservationError("");
        }}
      />

      {currentStep === 1 ? (
        <div className="availability-search-layout">
          <section className="availability-search-panel">
            <div className="availability-calendar-toolbar">
              <button
                type="button"
                onClick={() => setVisibleMonth((current) => addMonths(current, -1))}
                disabled={!canGoToPreviousMonth}
                aria-label="Mês anterior"
              >
                &lt;
              </button>
              <strong>{formatMonthLabel(visibleMonth)}</strong>
              <button
                type="button"
                onClick={() => setVisibleMonth((current) => addMonths(current, 1))}
                aria-label="Próximo mês"
              >
                &gt;
              </button>
            </div>

            <div className="availability-calendar-grid" role="grid" aria-label="Calendario">
              {WEEKDAYS.map((weekday) => (
                <span key={weekday} className="availability-calendar-grid__weekday">
                  {weekday}
                </span>
              ))}

              {monthDays.map((day, index) => {
                if (!day) {
                  return (
                    <span
                      key={`blank-${index}`}
                      className="availability-calendar-grid__day is-blank"
                    />
                  );
                }

                const isToday = isSameDay(day, today);
                const isSelectedCheckIn = isSameDay(day, checkIn);
                const isSelectedCheckOut = isSameDay(day, checkOut);
                const isInRange = isBetweenDays(day, checkIn, checkOut);
                const isPast = isBeforeDay(day, today);

                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    className={[
                      "availability-calendar-grid__day",
                      isToday ? "is-today" : "",
                      isSelectedCheckIn || isSelectedCheckOut ? "is-selected" : "",
                      isInRange ? "is-in-range" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => handleDateClick(day)}
                    disabled={isPast}
                  >
                    {day.getDate()}
                  </button>
                );
              })}
            </div>
          </section>

          <aside className="availability-search-summary">
            <div className="availability-flow-panel-heading">
              <h3>Datas e viajantes</h3>
              <span>Escolha o período e a ocupacao</span>
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
                <strong>{nights || "-"}</strong>
              </div>
            </div>

            <TravelerStepper
              label="Adultos"
              value={adults}
              min={MIN_ADULTS}
              max={MAX_ADULTS}
              onChange={(value) => {
                setAdults(value);
                resetReservationStepState();
              }}
            />
            <TravelerStepper
              label="Crianças"
              value={children}
              min={MIN_CHILDREN}
              max={MAX_CHILDREN}
              onChange={(value) => {
                setChildren(value);
                resetReservationStepState();
              }}
            />

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
            <div className="availability-flow-panel-heading">
              <h3>Escolha seu quarto</h3>
              <span>Somente quartos disponíveis podem seguir para a solicitação</span>
            </div>
          </div>

          {roomResults.length ? (
            <div className="availability-room-list">
              {roomResults.map(({ room, availabilityStatus, priceEstimate, capacityLabel }) => {
                const fallbackTotalPriceCents = room.lowestActiveRateCents
                  ? room.lowestActiveRateCents * nights
                  : null;
                const roomDetailsHref = hotelSlug ? `/hoteis/${hotelSlug}#quarto-${room.id}` : null;
                const statusLabel =
                  availabilityStatus === "available"
                    ? "Disponível"
                    : availabilityStatus === "unavailable"
                      ? "Indisponível"
                      : "Consultar disponibilidade";

                return (
                  <article
                    key={room.id}
                    className={[
                      "availability-room-card",
                      selectedRoomId === room.id ? "is-selected" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <div className="availability-room-card__media">
                      <RoomImageCarousel
                        images={room.images}
                        fallbackImageUrl={room.imageUrl}
                        roomName={room.name}
                        fallbackLabel={`Imagem indisponível do quarto ${room.name}`}
                        sizes="(max-width: 560px) 100vw, 180px"
                      />
                    </div>
                    <div className="availability-room-card__content">
                      <div className="availability-room-card__header">
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
                      <p className="availability-room-card__description">{room.description}</p>
                      <div className="hotel-room-meta availability-room-card__meta">
                        <span>{capacityLabel}</span>
                        <span>{room.beds}</span>
                        <span>{room.sizeM2 ? `${room.sizeM2} m²` : room.size}</span>
                      </div>
                      <div className="availability-room-card__footer">
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
                              ? `Total estimado: ${formatPriceInBRL(priceEstimate.totalPriceCents)}`
                              : fallbackTotalPriceCents
                                ? `Total estimado: ${formatPriceInBRL(fallbackTotalPriceCents)}`
                                : "Valor estimado sob consulta."}
                          </span>
                        </div>

                        <div className="availability-room-card__actions">
                          {roomDetailsHref ? (
                            <a
                              href={roomDetailsHref}
                              className="availability-room-card__details-link"
                            >
                              Ver pagina do quarto
                            </a>
                          ) : null}

                          {availabilityStatus === "available" ? (
                            <button
                              type="button"
                              className="availability-room-card__cta"
                              onClick={() => {
                                setSelectedRoomId(room.id);
                                setReservationError("");
                                setCurrentStep(3);
                              }}
                            >
                              Selecionar quarto
                            </button>
                          ) : (
                            <span className="availability-room-card__cta is-disabled">
                              Indisponível
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="hotel-empty-state availability-flow-empty">
              <strong>Nenhum quarto disponível para essa consulta.</strong>
              <p>Ajuste datas ou viajantes para seguir com a solicitação.</p>
            </div>
          )}
        </section>
      ) : currentStep === 3 && checkIn && checkOut && selectedRoomResult ? (
        <section className="availability-guest-step">
          <div className="availability-results-header">
            <div className="availability-flow-panel-heading">
              <h3>Dados do hóspede</h3>
              <span>A reserva ainda não está confirmada nesta etapa</span>
            </div>
          </div>

          <div className="availability-guest-layout">
            <aside className="availability-reservation-summary">
              <h3>Resumo da solicitação</h3>
              <div className="availability-confirmation-details">
                <div>
                  <span>Hotel</span>
                  <strong>{hotelName}</strong>
                </div>
                <div>
                  <span>Quarto</span>
                  <strong>{selectedRoomResult.room.name}</strong>
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
                  <span>Valor total</span>
                  <strong>{selectedTotalPriceLabel}</strong>
                </div>
              </div>
            </aside>

            <form
              className="availability-reservation-form"
              onSubmit={(event) => {
                event.preventDefault();
                handleGuestDataProceed();
              }}
            >
              <label>
                Nome completo
                <input
                  type="text"
                  value={guestName}
                  onChange={(event) => {
                    setGuestName(event.target.value);
                    setGuestFormErrors((current) => ({ ...current, guestName: undefined }));
                  }}
                  required
                  minLength={3}
                  maxLength={120}
                  autoComplete="name"
                  aria-invalid={Boolean(guestFormErrors.guestName)}
                />
                {guestFormErrors.guestName ? <span>{guestFormErrors.guestName}</span> : null}
              </label>

              <label>
                E-mail
                <input
                  type="email"
                  value={guestEmail}
                  onChange={(event) => {
                    setGuestEmail(event.target.value);
                    setGuestFormErrors((current) => ({ ...current, guestEmail: undefined }));
                  }}
                  required
                  maxLength={180}
                  autoComplete="email"
                  aria-invalid={Boolean(guestFormErrors.guestEmail)}
                />
                {guestFormErrors.guestEmail ? <span>{guestFormErrors.guestEmail}</span> : null}
              </label>

              <label>
                Telefone
                <input
                  type="tel"
                  value={guestPhone}
                  onChange={(event) => {
                    setGuestPhone(event.target.value);
                    setGuestFormErrors((current) => ({ ...current, guestPhone: undefined }));
                  }}
                  required
                  minLength={8}
                  maxLength={30}
                  autoComplete="tel"
                  aria-invalid={Boolean(guestFormErrors.guestPhone)}
                />
                {guestFormErrors.guestPhone ? <span>{guestFormErrors.guestPhone}</span> : null}
              </label>

              <label>
                CPF ou passaporte
                <input
                  type="text"
                  value={guestDocument}
                  onChange={(event) => {
                    setGuestDocument(event.target.value);
                    setGuestFormErrors((current) => ({ ...current, guestDocument: undefined }));
                  }}
                  onBlur={() => {
                    setGuestDocumentTouched(true);

                    if (!normalizeGuestDocument(guestDocument)) {
                      setGuestFormErrors((current) => ({
                        ...current,
                        guestDocument: getGuestDocumentError(guestDocument),
                      }));
                    } else {
                      setGuestFormErrors((current) => ({ ...current, guestDocument: undefined }));
                    }
                  }}
                  maxLength={40}
                  autoComplete="off"
                  placeholder="Digite seu CPF ou passaporte"
                  aria-invalid={Boolean(guestFormErrors.guestDocument)}
                />
                {guestDocumentTouched && guestFormErrors.guestDocument ? (
                  <span>{guestFormErrors.guestDocument}</span>
                ) : null}
              </label>

              <button type="submit" className="availability-confirmation-cta">
                Continuar para pagamento por cartão
              </button>
            </form>
          </div>
        </section>
      ) : currentStep === 4 && checkIn && checkOut && selectedRoomResult ? (
        <section className="availability-confirmation-step">
          <div className="availability-results-header">
            <div className="availability-flow-panel-heading">
              <h3>Pagamento por cartão</h3>
              <span>
                Sua solicitação de reserva será enviada ao hotel. O pagamento será finalizado
                diretamente com a equipe do hotel.
              </span>
            </div>
          </div>

          <div className="availability-confirmation-card">
            <div className="availability-payment-summary">
              <strong>Resumo do pagamento</strong>
              <div className="availability-confirmation-details">
                <div>
                  <span>Quarto</span>
                  <strong>{selectedRoomResult.room.name}</strong>
                </div>
                <div>
                  <span>Periodo</span>
                  <strong>
                    {formatDateLabel(checkIn)} a {formatDateLabel(checkOut)}
                  </strong>
                </div>
                <div>
                  <span>Hóspedes</span>
                  <strong>
                    {adults} adulto(s), {children} criança(s)
                  </strong>
                </div>
                <div>
                  <span>Tipo do cartão</span>
                  <strong>{formatPaymentMethodLabel(paymentMethod)}</strong>
                </div>
                <div>
                  <span>Bandeira</span>
                  <strong>{formatPaymentCardBrandLabel(paymentCardBrand)}</strong>
                </div>
                <div>
                  <span>Total estimado</span>
                  <strong>{selectedTotalPriceLabel}</strong>
                </div>
              </div>
              <p>{PAYMENT_INFO_TEXT}</p>
            </div>

            <div className="availability-reservation-form">
              <div className="availability-payment-fieldset">
                <span>Tipo do cartão *</span>
                <div className="availability-payment-methods">
                  {PAYMENT_METHOD_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={[
                        "availability-payment-method",
                        paymentMethod === option.value ? "is-selected" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={() => {
                        setPaymentMethod(option.value);
                        setReservationError("");
                      }}
                      aria-pressed={paymentMethod === option.value}
                    >
                      <span className="availability-payment-method__icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24">
                          <path d="M4 7h16v10H4zM4 10h16M8 14h4" />
                        </svg>
                      </span>
                      <span>
                        <strong>{option.label}</strong>
                        {option.description ? <small>{option.description}</small> : null}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <label>
                Bandeira do cartão *
                <select
                  value={paymentCardBrand}
                  onChange={(event) => {
                    const nextBrand = event.target.value as PaymentCardBrand | "";
                    setPaymentCardBrand(nextBrand);
                    setReservationError("");
                  }}
                  required
                >
                  <option value="">Selecione a bandeira</option>
                  {PAYMENT_CARD_BRAND_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="availability-card-data-fields">
                <label className="availability-card-data-field availability-card-data-field--number">
                  {PAYMENT_OBSERVATION_FIELDS[0].label}
                  <input
                    type="text"
                    autoComplete="cc-number"
                    inputMode="numeric"
                    value={paymentObservation1}
                    onChange={(event) => {
                      setPaymentObservation1(formatPaymentCardNumberInput(event.target.value));
                      setPaymentFormErrors((current) => ({
                        ...current,
                        paymentObservation1: undefined,
                      }));
                      setReservationError("");
                    }}
                    required
                    pattern="\d{4} \d{4} \d{4} \d{4}"
                    maxLength={19}
                    placeholder={PAYMENT_OBSERVATION_FIELDS[0].placeholder}
                    aria-invalid={Boolean(paymentFormErrors.paymentObservation1)}
                  />
                  {paymentFormErrors.paymentObservation1 ? (
                    <span>{paymentFormErrors.paymentObservation1}</span>
                  ) : null}
                </label>

                <label className="availability-card-data-field availability-card-data-field--expiry">
                  {PAYMENT_OBSERVATION_FIELDS[1].label}
                  <input
                    type="text"
                    autoComplete="cc-exp"
                    inputMode="numeric"
                    value={paymentObservation2}
                    onChange={(event) => {
                      setPaymentObservation2(formatPaymentExpiryInput(event.target.value));
                      setPaymentFormErrors((current) => ({
                        ...current,
                        paymentObservation2: undefined,
                      }));
                      setReservationError("");
                    }}
                    required
                    pattern="(0[1-9]|1[0-2])\/\d{2}"
                    maxLength={5}
                    placeholder={PAYMENT_OBSERVATION_FIELDS[1].placeholder}
                    aria-invalid={Boolean(paymentFormErrors.paymentObservation2)}
                  />
                  {paymentFormErrors.paymentObservation2 ? (
                    <span>{paymentFormErrors.paymentObservation2}</span>
                  ) : null}
                </label>

                <label className="availability-card-data-field availability-card-data-field--cvv">
                  {PAYMENT_OBSERVATION_FIELDS[2].label}
                  <input
                    type="text"
                    autoComplete="cc-csc"
                    inputMode="numeric"
                    value={paymentObservation3}
                    onChange={(event) => {
                      setPaymentObservation3(formatPaymentCvvInput(event.target.value));
                      setPaymentFormErrors((current) => ({
                        ...current,
                        paymentObservation3: undefined,
                      }));
                      setReservationError("");
                    }}
                    required
                    pattern="\d{3}"
                    maxLength={3}
                    placeholder={PAYMENT_OBSERVATION_FIELDS[2].placeholder}
                    aria-invalid={Boolean(paymentFormErrors.paymentObservation3)}
                  />
                  {paymentFormErrors.paymentObservation3 ? (
                    <span>{paymentFormErrors.paymentObservation3}</span>
                  ) : null}
                </label>
              </div>

              <p className="availability-card-data-note">
                Essas observações serão enviadas ao hotel junto da solicitação.
              </p>
            </div>

            {reservationError ? (
              <p className="availability-reservation-error" role="alert">
                {reservationError}
              </p>
            ) : null}

            {isSubmittingReservation ? (
              <div className="availability-payment-loading" role="status">
                <span aria-hidden="true" />
                <strong>Enviando solicitação de reserva...</strong>
                <p>O hotel recebera seus dados para continuar o atendimento.</p>
              </div>
            ) : null}

            <button
              type="button"
              className="availability-confirmation-cta"
              disabled={isSubmittingReservation}
              onClick={handleReservationSubmit}
            >
              {isSubmittingReservation
                ? "Enviando solicitação..."
                : "Enviar solicitação de reserva"}
            </button>
          </div>
        </section>
      ) : currentStep === 5 && checkIn && checkOut && selectedRoomResult ? (
        <section className="availability-confirmation-step">
          <div className="availability-results-header">
            <div className="availability-flow-panel-heading">
              <h3>Confirmacao</h3>
              <span>O hotel dara continuidade ao atendimento</span>
            </div>
          </div>

          <div className="availability-confirmation-card">
            <div className="availability-reservation-success" role="status">
              <h3>Solicitação de reserva enviada</h3>
              <p>
                Código da reserva: <strong>{createdReservationId}</strong>
              </p>
              <p>
                Sua solicitação de reserva foi enviada ao hotel. O pagamento será finalizado
                diretamente com a equipe do hotel.
              </p>
            </div>
          </div>
        </section>
      ) : (
        <section className="availability-search-results-placeholder">
          <div className="hotel-empty-state availability-flow-empty">
            <strong>Complete os dados da busca para continuar.</strong>
            <p>{validationMessage || "Volte para selecionar datas e viajantes."}</p>
          </div>
        </section>
      )}
    </section>
  );
}
