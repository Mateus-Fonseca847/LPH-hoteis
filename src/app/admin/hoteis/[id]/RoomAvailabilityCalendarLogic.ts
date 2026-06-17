import type { AuthorizedRoomAvailability } from "./room-availability-actions";

export type CalendarSavePayload = {
  roomId: string;
  startDate: string;
  endDate: string;
  totalUnits: number;
  availableUnits: number;
  closed: boolean;
  note?: string;
};

export type AvailabilityStatus = "none" | "available" | "occupied" | "closed";
export type AvailabilityMode = "available" | "occupied" | "closed";

export const DAY_MS = 86400000;

export function toUtcDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

export function formatCalendarDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" }).format(
    toUtcDate(value)
  );
}

export function getMonthRange(month: string) {
  const [year, monthIndex] = month.split("-").map(Number);
  const start = new Date(Date.UTC(year, monthIndex - 1, 1));
  const end = new Date(Date.UTC(year, monthIndex, 0));

  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

export function getCalendarDays(month: string) {
  const { startDate, endDate } = getMonthRange(month);
  const first = toUtcDate(startDate);
  const last = toUtcDate(endDate);
  const current = new Date(first);
  current.setUTCDate(current.getUTCDate() - current.getUTCDay());

  const days: Array<{ date: string; inMonth: boolean }> = [];

  while (days.length < 42) {
    const date = current.toISOString().slice(0, 10);

    days.push({
      date,
      inMonth: current.getUTCMonth() === first.getUTCMonth(),
    });

    current.setUTCDate(current.getUTCDate() + 1);

    if (current.getTime() > last.getTime() && current.getUTCDay() === 0) {
      break;
    }
  }

  return days;
}

export function resolveAvailabilityStatus(
  entry: AuthorizedRoomAvailability | undefined
): AvailabilityStatus {
  if (!entry) {
    return "none";
  }

  if (entry.closed) {
    return "closed";
  }

  return entry.availableUnits > 0 ? "available" : "occupied";
}

export function selectCalendarRange(
  current: { startDate: string | null; endDate: string | null },
  date: string
) {
  if (!current.startDate || current.endDate) {
    return { startDate: date, endDate: null };
  }

  if (date < current.startDate) {
    return { startDate: date, endDate: current.startDate };
  }

  return { startDate: current.startDate, endDate: date };
}

export function buildCalendarSavePayload({
  roomId,
  startDate,
  endDate,
  mode,
  totalUnits,
  availableUnits,
  closed,
  note,
}: {
  roomId: string;
  startDate: string;
  endDate: string;
  mode: AvailabilityMode;
  totalUnits: number;
  availableUnits: number;
  closed: boolean;
  note: string;
}): CalendarSavePayload {
  if (mode === "closed") {
    return {
      roomId,
      startDate,
      endDate,
      totalUnits: Math.max(totalUnits, 0),
      availableUnits: 0,
      closed: true,
      note: note.trim() || undefined,
    };
  }

  if (mode === "occupied") {
    return {
      roomId,
      startDate,
      endDate,
      totalUnits: Math.max(totalUnits, 0),
      availableUnits: 0,
      closed: false,
      note: note.trim() || undefined,
    };
  }

  const safeAvailableUnits = Math.max(availableUnits, 1);

  return {
    roomId,
    startDate,
    endDate,
    totalUnits: Math.max(totalUnits, safeAvailableUnits),
    availableUnits: safeAvailableUnits,
    closed,
    note: note.trim() || undefined,
  };
}

export function shiftCalendarMonth(month: string, offset: number) {
  const [year, monthIndex] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthIndex - 1 + offset, 1));
  return date.toISOString().slice(0, 7);
}
