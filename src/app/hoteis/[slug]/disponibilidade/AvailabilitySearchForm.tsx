"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type AvailabilitySearchFormProps = {
  hotelSlug: string;
  defaultCheckIn: string;
  defaultCheckOut: string;
  defaultAdults: number;
  defaultChildren: number;
  minCheckIn: string;
};

type FormErrors = {
  checkIn?: string;
  checkOut?: string;
  adults?: string;
  children?: string;
};

function isValidDateInput(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00`);

  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validateAvailabilityForm(values: {
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  minCheckIn: string;
}) {
  const errors: FormErrors = {};

  if (!values.checkIn) {
    errors.checkIn = "Informe a data de check-in.";
  } else if (!isValidDateInput(values.checkIn) || values.checkIn < values.minCheckIn) {
    errors.checkIn = "Escolha uma data de check-in válida.";
  }

  if (!values.checkOut) {
    errors.checkOut = "Informe a data de check-out.";
  } else if (!isValidDateInput(values.checkOut)) {
    errors.checkOut = "Escolha uma data de check-out válida.";
  } else if (values.checkIn && values.checkOut <= values.checkIn) {
    errors.checkOut = "O check-out deve ser posterior ao check-in.";
  }

  if (!Number.isInteger(values.adults) || values.adults < 1) {
    errors.adults = "Informe pelo menos 1 adulto.";
  }

  if (!Number.isInteger(values.children) || values.children < 0) {
    errors.children = "A quantidade de crianças deve ser 0 ou mais.";
  }

  return errors;
}

export function AvailabilitySearchForm({
  hotelSlug,
  defaultCheckIn,
  defaultCheckOut,
  defaultAdults,
  defaultChildren,
  minCheckIn,
}: AvailabilitySearchFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [checkIn, setCheckIn] = useState(defaultCheckIn);
  const [checkOut, setCheckOut] = useState(defaultCheckOut);
  const [adults, setAdults] = useState(String(defaultAdults));
  const [children, setChildren] = useState(String(defaultChildren));
  const [errors, setErrors] = useState<FormErrors>({});

  function clearError(field: keyof FormErrors) {
    setErrors((current) => {
      if (!current[field]) {
        return current;
      }

      return {
        ...current,
        [field]: undefined,
      };
    });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsedAdults = Number.parseInt(adults, 10);
    const parsedChildren = Number.parseInt(children, 10);

    const nextErrors = validateAvailabilityForm({
      checkIn,
      checkOut,
      adults: parsedAdults,
      children: parsedChildren,
      minCheckIn,
    });

    setErrors(nextErrors);

    if (Object.values(nextErrors).some(Boolean)) {
      return;
    }

    const query = new URLSearchParams({
      checkIn,
      checkOut,
      adults: String(parsedAdults),
      children: String(parsedChildren),
    });

    startTransition(() => {
      router.push(`/hoteis/${hotelSlug}/disponibilidade?${query.toString()}`);
    });
  }

  return (
    <form className="hotel-availability-form" noValidate onSubmit={handleSubmit}>
      <div className="hotel-availability-grid">
        <label className={`hotel-availability-field${errors.checkIn ? " is-invalid" : ""}`}>
          <span>Check-in</span>
          <input
            type="date"
            name="checkIn"
            value={checkIn}
            min={minCheckIn}
            aria-invalid={Boolean(errors.checkIn)}
            aria-describedby={errors.checkIn ? "availability-checkin-error" : undefined}
            onChange={(event) => {
              setCheckIn(event.target.value);
              clearError("checkIn");
            }}
          />
          {errors.checkIn ? (
            <small id="availability-checkin-error" className="hotel-availability-error">
              {errors.checkIn}
            </small>
          ) : null}
        </label>

        <label className={`hotel-availability-field${errors.checkOut ? " is-invalid" : ""}`}>
          <span>Check-out</span>
          <input
            type="date"
            name="checkOut"
            value={checkOut}
            min={checkIn || minCheckIn}
            aria-invalid={Boolean(errors.checkOut)}
            aria-describedby={errors.checkOut ? "availability-checkout-error" : undefined}
            onChange={(event) => {
              setCheckOut(event.target.value);
              clearError("checkOut");
            }}
          />
          {errors.checkOut ? (
            <small id="availability-checkout-error" className="hotel-availability-error">
              {errors.checkOut}
            </small>
          ) : null}
        </label>

        <label className={`hotel-availability-field${errors.adults ? " is-invalid" : ""}`}>
          <span>Adultos</span>
          <select
            name="adults"
            value={adults}
            aria-invalid={Boolean(errors.adults)}
            aria-describedby={errors.adults ? "availability-adults-error" : undefined}
            onChange={(event) => {
              setAdults(event.target.value);
              clearError("adults");
            }}
          >
            {[1, 2, 3, 4, 5, 6].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          {errors.adults ? (
            <small id="availability-adults-error" className="hotel-availability-error">
              {errors.adults}
            </small>
          ) : null}
        </label>

        <label className={`hotel-availability-field${errors.children ? " is-invalid" : ""}`}>
          <span>Crianças</span>
          <select
            name="children"
            value={children}
            aria-invalid={Boolean(errors.children)}
            aria-describedby={errors.children ? "availability-children-error" : undefined}
            onChange={(event) => {
              setChildren(event.target.value);
              clearError("children");
            }}
          >
            {[0, 1, 2, 3, 4].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          {errors.children ? (
            <small id="availability-children-error" className="hotel-availability-error">
              {errors.children}
            </small>
          ) : null}
        </label>
      </div>

      <p className="hotel-availability-help">
        Esta primeira consulta organiza suas datas e o perfil da hospedagem.
      </p>

      <button type="submit" className="card-cta-button hotel-page-cta" disabled={isPending}>
        {isPending ? "Consultando..." : "Consultar disponibilidade"}
      </button>
    </form>
  );
}
