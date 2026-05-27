"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
  getCompatibleRoomAvailabilityResults,
  type AvailabilityResultRoom,
} from "@/lib/availability-results";
import { getGuestDocumentError, normalizeGuestDocument } from "@/lib/guest-document";
import { formatPriceInBRL } from "@/lib/stay-query";

type AvailabilitySearchModalProps = {
  hotelSlug?: string;
  hotelId: string;
  hotelName: string;
  roomName?: string;
  rooms: AvailabilityResultRoom[];
  onClose?: () => void;
  variant?: "modal" | "page";
};

type CreateReservationResponse = {
  ok: boolean;
  error?: string;
  checkoutUrl?: string | null;
  payment?: PaymentStartDetails | null;
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

type AvailabilityFlowStep = 1 | 2 | 3 | 4 | 5;
type PaymentMethod = "pix" | "credit_card" | "debit_card" | "boleto";

type PaymentStartDetails = {
  method: PaymentMethod;
  checkoutUrl?: string | null;
  pix?: {
    qrCodeImageUrl?: string | null;
    copyPaste?: string | null;
  } | null;
  boleto?: {
    url?: string | null;
    digitableLine?: string | null;
    expiresAt?: string | null;
  } | null;
};

type PaymentMethodOption = {
  id: PaymentMethod;
  name: string;
  description: string;
};

const AVAILABILITY_FLOW_STEPS = [
  "Datas e viajantes",
  "Escolha do quarto",
  "Dados do hóspede",
  "Pagamento",
  "Confirmação",
] as const;
const PAYMENT_METHOD_OPTIONS: PaymentMethodOption[] = [
  {
    id: "pix",
    name: "Pix",
    description: "Pagamento instantâneo via QR Code ou copia e cola.",
  },
  {
    id: "credit_card",
    name: "Cartão de crédito",
    description: "Pague com cartão de crédito de forma segura.",
  },
  {
    id: "debit_card",
    name: "Cartão de débito",
    description: "Pague com cartão de débito, quando disponível.",
  },
  {
    id: "boleto",
    name: "Boleto",
    description: "Gere um boleto para pagamento dentro do prazo.",
  },
];
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
    errors.guestPhone = "Informe um telefone válido.";
  }

  if (!normalizeGuestDocument(guestDocument)) {
    errors.guestDocument = getGuestDocumentError(guestDocument);
  }

  return errors;
}

function PixIcon() {
  return (
    <svg
      className="availability-payment-pix-icon"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 640 640"
      aria-hidden="true"
    >
      <path
        fill="rgb(147, 254, 214)"
        d="M306.4 356.5C311.8 351.1 321.1 351.1 326.5 356.5L403.5 433.5C417.7 447.7 436.6 455.5 456.6 455.5L471.7 455.5L374.6 552.6C344.3 582.1 295.1 582.1 264.8 552.6L167.3 455.2L176.6 455.2C196.6 455.2 215.5 447.4 229.7 433.2L306.4 356.5zM326.5 282.9C320.1 288.4 311.9 288.5 306.4 282.9L229.7 206.2C215.5 191.1 196.6 184.2 176.6 184.2L167.3 184.2L264.7 86.8C295.1 56.5 344.3 56.5 374.6 86.8L471.8 183.9L456.6 183.9C436.6 183.9 417.7 191.7 403.5 205.9L326.5 282.9zM176.6 206.7C190.4 206.7 203.1 212.3 213.7 222.1L290.4 298.8C297.6 305.1 307 309.6 316.5 309.6C325.9 309.6 335.3 305.1 342.5 298.8L419.5 221.8C429.3 212.1 442.8 206.5 456.6 206.5L494.3 206.5L552.6 264.8C582.9 295.1 582.9 344.3 552.6 374.6L494.3 432.9L456.6 432.9C442.8 432.9 429.3 427.3 419.5 417.5L342.5 340.5C328.6 326.6 304.3 326.6 290.4 340.6L213.7 417.2C203.1 427 190.4 432.6 176.6 432.6L144.8 432.6L86.8 374.6C56.5 344.3 56.5 295.1 86.8 264.8L144.8 206.7L176.6 206.7z"
      />
    </svg>
  );
}

function PaymentMethodIcon({ method }: { method: PaymentMethod }) {
  if (method === "pix") {
    return <PixIcon />;
  }

  if (method === "boleto") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h3M15 16h1" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h16v10H4zM4 10h16M8 14h4" />
    </svg>
  );
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

export function AvailabilitySearchModal({
  hotelSlug,
  hotelId,
  hotelName,
  roomName,
  rooms,
  onClose,
  variant = "modal",
}: AvailabilitySearchModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const modalRef = useRef<HTMLElement | null>(null);
  const isPageVariant = variant === "page";
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
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null);
  const [reservationError, setReservationError] = useState("");
  const [paymentDetails, setPaymentDetails] = useState<PaymentStartDetails | null>(null);
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
    : "Calculado no checkout";
  const validationMessage = !checkIn
    ? "Selecione a data de check-in para continuar."
    : !checkOut
      ? "Selecione a data de check-out para continuar."
      : nights <= 0
        ? "O check-out deve ser posterior ao check-in."
        : adults < MIN_ADULTS
          ? "Informe pelo menos 1 adulto."
          : "";
  useEffect(() => {
    if (isPageVariant || !onClose) {
      return;
    }

    const handleClose = onClose;
    const previouslyFocusedElement =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    modalRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        handleClose();
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
          element.getClientRects().length > 0
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
  }, [isPageVariant, onClose]);

  function handleDateClick(date: Date) {
    if (isBeforeDay(date, today)) {
      return;
    }

    if (!checkIn || checkOut || !isAfterDay(date, checkIn)) {
      setCheckIn(date);
      setCheckOut(null);
      setCurrentStep(1);
      setSelectedRoomId(null);
      setSelectedPaymentMethod(null);
      setPaymentDetails(null);
      setCreatedReservationId(null);
      setReservationError("");
      return;
    }

    setCheckOut(date);
    setCurrentStep(1);
    setSelectedRoomId(null);
    setSelectedPaymentMethod(null);
    setPaymentDetails(null);
    setCreatedReservationId(null);
    setReservationError("");
  }

  function handleAdultsChange(value: number) {
    setAdults(value);
    setSelectedRoomId(null);
    setSelectedPaymentMethod(null);
    setPaymentDetails(null);
    setCreatedReservationId(null);
    setReservationError("");
  }

  function handleChildrenChange(value: number) {
    setChildren(value);
    setSelectedRoomId(null);
    setSelectedPaymentMethod(null);
    setPaymentDetails(null);
    setCreatedReservationId(null);
    setReservationError("");
  }

  function handleProceed() {
    if (!hasValidStay) {
      return;
    }

    setCurrentStep(2);
  }

  function handlePreviousStep() {
    if (currentStep === 1) {
      return;
    }

    if (currentStep === 2) {
      setCurrentStep(1);
      setCreatedReservationId(null);
      setReservationError("");
      return;
    }

    setCurrentStep((current) => Math.max(2, current - 1) as AvailabilityFlowStep);
    setReservationError("");
    setPaymentDetails(null);
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
    setPaymentDetails(null);
    setCurrentStep(4);
  }

  async function handleReservationSubmit() {
    if (!checkIn || !checkOut || !selectedRoomResult || isSubmittingReservation) {
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
          paymentMethod: selectedPaymentMethod,
        }),
      });
      const payload = (await response.json().catch(() => null)) as CreateReservationResponse | null;

      if (!response.ok || !payload?.ok || !payload.reservation) {
        throw new Error("payment_start_failed");
      }

      const payment = payload.payment ?? null;
      const checkoutUrl = payment?.checkoutUrl || payload.checkoutUrl;

      if (checkoutUrl) {
        setCreatedReservationId(payload.reservation.id);
        window.location.assign(checkoutUrl);
        return;
      }

      if (
        payment?.pix?.copyPaste ||
        payment?.pix?.qrCodeImageUrl ||
        payment?.boleto?.url ||
        payment?.boleto?.digitableLine
      ) {
        setPaymentDetails(payment);
        setCreatedReservationId(payload.reservation.id);
        return;
      }

      throw new Error("payment_start_failed");
    } catch {
      setReservationError(
        "Não foi possível iniciar o pagamento. Verifique os dados e tente novamente."
      );
    } finally {
      setIsSubmittingReservation(false);
    }
  }

  async function handleCopyPaymentCode(value: string) {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      setReservationError("Não foi possível copiar o código automaticamente.");
    }
  }

  function renderPaymentInstructions() {
    if (!paymentDetails) {
      return null;
    }

    if (
      paymentDetails.method === "pix" &&
      (paymentDetails.pix?.copyPaste || paymentDetails.pix?.qrCodeImageUrl)
    ) {
      return (
        <div className="availability-payment-instructions" role="status">
          <strong>Pagamento Pix gerado</strong>
          <p>
            Use o QR Code ou copie o código Pix abaixo. A reserva fica pendente e só será confirmada
            após a aprovação do pagamento.
          </p>
          {paymentDetails.pix.qrCodeImageUrl ? (
            <Image
              src={paymentDetails.pix.qrCodeImageUrl}
              alt="QR Code Pix para pagamento"
              width={220}
              height={220}
              unoptimized
            />
          ) : null}
          {paymentDetails.pix.copyPaste ? (
            <div className="availability-payment-code">
              <code>{paymentDetails.pix.copyPaste}</code>
              <button
                type="button"
                onClick={() => handleCopyPaymentCode(paymentDetails.pix?.copyPaste || "")}
              >
                Copiar código
              </button>
            </div>
          ) : null}
        </div>
      );
    }

    if (
      paymentDetails.method === "boleto" &&
      (paymentDetails.boleto?.url || paymentDetails.boleto?.digitableLine)
    ) {
      return (
        <div className="availability-payment-instructions" role="status">
          <strong>Boleto gerado</strong>
          <p>
            Pague o boleto dentro do prazo. A reserva fica pendente e só será confirmada após a
            compensação do pagamento.
          </p>
          {paymentDetails.boleto.digitableLine ? (
            <div className="availability-payment-code">
              <code>{paymentDetails.boleto.digitableLine}</code>
              <button
                type="button"
                onClick={() => handleCopyPaymentCode(paymentDetails.boleto?.digitableLine || "")}
              >
                Copiar linha
              </button>
            </div>
          ) : null}
          {paymentDetails.boleto.url ? (
            <a
              className="availability-confirmation-cta"
              href={paymentDetails.boleto.url}
              target="_blank"
              rel="noreferrer"
            >
              Abrir boleto
            </a>
          ) : null}
        </div>
      );
    }

    return null;
  }

  const flowContent = (
    <section
      ref={modalRef}
      className={`hotel-availability-modal ${
        isPageVariant ? "hotel-availability-modal--page" : ""
      }`}
      role={isPageVariant ? undefined : "dialog"}
      aria-modal={isPageVariant ? undefined : "true"}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      tabIndex={isPageVariant ? undefined : -1}
    >
      <header className="hotel-availability-modal-header">
        <div>
          <span className="hotel-page-eyebrow">Disponibilidade</span>
          <h2 id={titleId}>Consultar disponibilidade</h2>
          <p id={descriptionId}>
            Consulte datas, escolha um quarto e avance ao pagamento seguro. A reserva só é
            confirmada depois da aprovação do pagamento no {hotelName}
            {context}.
          </p>
        </div>

        {!isPageVariant && onClose ? (
          <button
            type="button"
            className="hotel-availability-modal-close"
            onClick={onClose}
            aria-label="Fechar consulta de disponibilidade"
          >
            X
          </button>
        ) : null}
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
              <span>Adultos e crianças</span>
            </div>
            <div className="availability-traveler-list">
              <TravelerStepper
                label="Adultos"
                value={adults}
                min={MIN_ADULTS}
                max={MAX_ADULTS}
                onChange={handleAdultsChange}
              />
              <TravelerStepper
                label="Crianças"
                value={children}
                min={MIN_CHILDREN}
                max={MAX_CHILDREN}
                onChange={handleChildrenChange}
              />
            </div>

            <div className="availability-search-modal-panel-heading">
              <h3>Período</h3>
              <span>Escolha check-in e check-out</span>
            </div>
            <div className="availability-calendar">
              <div className="availability-calendar-toolbar">
                <button
                  type="button"
                  onClick={() => setVisibleMonth((current) => addMonths(current, -1))}
                  disabled={!canGoToPreviousMonth}
                  aria-label="Mês anterior"
                >
                  Anterior
                </button>
                <strong>{formatMonthLabel(visibleMonth)}</strong>
                <button
                  type="button"
                  onClick={() => setVisibleMonth((current) => addMonths(current, 1))}
                  aria-label="Próximo mês"
                >
                  Próximo
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
                <span>Seleção atual</span>
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
                  <span>Crianças</span>
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
              <span>Somente quartos disponíveis podem seguir para pagamento</span>
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
              <span>Crianças</span>
              <strong>{children}</strong>
            </div>
          </div>

          {roomResults.length ? (
            <div className="availability-modal-room-list">
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
                        <span>{room.sizeM2 ? `${room.sizeM2} m²` : room.size}</span>
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
                              ? `Total estimado: ${formatPriceInBRL(priceEstimate.totalPriceCents)}`
                              : fallbackTotalPriceCents
                                ? `Total estimado: ${formatPriceInBRL(fallbackTotalPriceCents)}`
                                : "Valor calculado no checkout."}
                          </span>
                        </div>

                        <div className="availability-modal-room-card__actions">
                          {roomDetailsHref ? (
                            <a
                              href={roomDetailsHref}
                              className="availability-modal-room-card__details-link"
                            >
                              Ver página do quarto
                            </a>
                          ) : null}

                          {availabilityStatus === "available" ? (
                            <button
                              type="button"
                              className="availability-modal-room-card__cta"
                              onClick={() => {
                                setSelectedRoomId(room.id);
                                setSelectedPaymentMethod(null);
                                setPaymentDetails(null);
                                setCreatedReservationId(null);
                                setReservationError("");
                                setCurrentStep(3);
                              }}
                            >
                              Selecionar quarto
                            </button>
                          ) : (
                            <span className="availability-modal-room-card__cta is-disabled">
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
            <div className="hotel-empty-state availability-modal-empty">
              <strong>Nenhum quarto disponível para essa consulta.</strong>
              <p>
                Ajuste datas ou viajantes. Se preferir, fale com a equipe do hotel para avaliar
                alternativas.
              </p>
            </div>
          )}
        </section>
      ) : currentStep === 3 && checkIn && checkOut && selectedRoomResult ? (
        <section className="availability-guest-step">
          <div className="availability-results-header">
            <div className="availability-search-modal-panel-heading">
              <h3>Dados do hóspede</h3>
              <span>A reserva ainda não está confirmada nesta etapa</span>
            </div>
          </div>

          <div className="availability-guest-layout">
            <aside className="availability-reservation-summary">
              <h3>Resumo antes do pagamento</h3>
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
                  <span>Adultos</span>
                  <strong>{adults}</strong>
                </div>
                <div>
                  <span>Crianças</span>
                  <strong>{children}</strong>
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
                  aria-describedby={
                    guestFormErrors.guestName ? "availability-guest-name-error" : undefined
                  }
                  aria-invalid={Boolean(guestFormErrors.guestName)}
                />
                {guestFormErrors.guestName ? (
                  <span id="availability-guest-name-error">{guestFormErrors.guestName}</span>
                ) : null}
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
                  aria-describedby={
                    guestFormErrors.guestEmail ? "availability-guest-email-error" : undefined
                  }
                  aria-invalid={Boolean(guestFormErrors.guestEmail)}
                />
                {guestFormErrors.guestEmail ? (
                  <span id="availability-guest-email-error">{guestFormErrors.guestEmail}</span>
                ) : null}
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
                  aria-describedby={
                    guestFormErrors.guestPhone ? "availability-guest-phone-error" : undefined
                  }
                  aria-invalid={Boolean(guestFormErrors.guestPhone)}
                />
                {guestFormErrors.guestPhone ? (
                  <span id="availability-guest-phone-error">{guestFormErrors.guestPhone}</span>
                ) : null}
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
                  inputMode="text"
                  aria-describedby={
                    guestDocumentTouched && guestFormErrors.guestDocument
                      ? "availability-guest-document-error"
                      : undefined
                  }
                  aria-invalid={Boolean(guestFormErrors.guestDocument)}
                />
                {guestDocumentTouched && guestFormErrors.guestDocument ? (
                  <span id="availability-guest-document-error">
                    {guestFormErrors.guestDocument}
                  </span>
                ) : null}
              </label>

              <button type="submit" className="availability-confirmation-cta">
                Continuar para pagamento
              </button>
            </form>
          </div>
        </section>
      ) : currentStep === 4 && checkIn && checkOut && selectedRoomResult ? (
        <section className="availability-confirmation-step">
          <div className="availability-results-header">
            <div className="availability-search-modal-panel-heading">
              <h3>Escolha a forma de pagamento</h3>
              <span>A reserva será criada como pendente antes do pagamento</span>
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
                  <span>Período</span>
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
                  <span>Total estimado</span>
                  <strong>{selectedTotalPriceLabel}</strong>
                </div>
              </div>
              <p>
                Ao prosseguir, a reserva fica aguardando pagamento. Confirmação e e-mails só
                acontecem depois da aprovação pelo provedor.
              </p>
            </div>

            <div
              className="availability-payment-methods"
              role="radiogroup"
              aria-label="Forma de pagamento"
            >
              {PAYMENT_METHOD_OPTIONS.map((option) => {
                const isSelected = selectedPaymentMethod === option.id;

                return (
                  <button
                    key={option.id}
                    type="button"
                    className={`availability-payment-method ${isSelected ? "is-selected" : ""}`}
                    onClick={() => {
                      setSelectedPaymentMethod(option.id);
                      setPaymentDetails(null);
                      setReservationError("");
                    }}
                    role="radio"
                    aria-checked={isSelected}
                  >
                    <span className="availability-payment-method__icon">
                      <PaymentMethodIcon method={option.id} />
                    </span>
                    <span>
                      <strong>{option.name}</strong>
                      <small>{option.description}</small>
                    </span>
                  </button>
                );
              })}
            </div>

            {reservationError ? (
              <p className="availability-reservation-error" role="alert">
                {reservationError}
              </p>
            ) : null}

            {isSubmittingReservation ? (
              <div className="availability-payment-loading" role="status">
                <span aria-hidden="true" />
                <strong>Criando reserva pendente e iniciando pagamento...</strong>
                <p>Você será redirecionado para um checkout seguro quando tudo estiver pronto.</p>
              </div>
            ) : null}

            {renderPaymentInstructions()}

            <button
              type="button"
              className="availability-confirmation-cta"
              disabled={
                !selectedPaymentMethod || isSubmittingReservation || Boolean(paymentDetails)
              }
              onClick={handleReservationSubmit}
            >
              {isSubmittingReservation
                ? "Iniciando pagamento..."
                : "Criar reserva e iniciar pagamento"}
            </button>
          </div>
        </section>
      ) : currentStep === 5 && checkIn && checkOut && selectedRoomResult ? (
        <section className="availability-confirmation-step">
          <div className="availability-results-header">
            <div className="availability-search-modal-panel-heading">
              <h3>Confirmação</h3>
              <span>Acompanhe a confirmação do pagamento</span>
            </div>
          </div>

          <div className="availability-confirmation-card">
            <div className="availability-reservation-success" role="status">
              <span className="hotel-page-eyebrow">Pagamento iniciado</span>
              <h3>Reserva aguardando confirmação</h3>
              <p>
                Código da reserva: <strong>{createdReservationId}</strong>
              </p>
              <p>A confirmação ocorre somente após aprovação do pagamento.</p>
            </div>
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
  );

  if (isPageVariant) {
    return flowContent;
  }

  return createPortal(
    <div className="hotel-availability-modal-backdrop" role="presentation">
      {flowContent}
    </div>,
    document.body
  );
}
