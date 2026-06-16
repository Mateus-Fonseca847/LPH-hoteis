import type { AuthorizedRoomRate } from "./room-rate-actions";
import { createRoomRatePayloadSchema } from "@/lib/validations/room-rate";

export type RateFormValues = {
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

export type RateFormErrors = Partial<Record<keyof RateFormValues, string>> & {
  general?: string;
};

export type RateFormMode = "create" | "edit";

export const EMPTY_RATE_FORM: RateFormValues = {
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

export function parsePriceToCents(value: string) {
  const normalized = value.replace(",", ".").trim();

  if (!normalized) {
    return Number.NaN;
  }

  return Math.round(Number(normalized) * 100);
}

export function formatPriceFromCents(value: number) {
  return (value / 100).toFixed(2).replace(".", ",");
}

export function formatPriceLabel(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value / 100);
}

export function formatRatePeriod(rate: AuthorizedRoomRate) {
  const formatter = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
  });

  return `${formatter.format(new Date(rate.startDate))} - ${formatter.format(new Date(rate.endDate))}`;
}

export function getRateFormValues(rate: AuthorizedRoomRate): RateFormValues {
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

export function buildRatePayload(roomId: string, values: RateFormValues) {
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

export function validateRateForm(roomId: string, values: RateFormValues): RateFormErrors {
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
