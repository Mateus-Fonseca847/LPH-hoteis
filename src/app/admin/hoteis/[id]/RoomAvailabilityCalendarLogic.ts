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

export type AvailabilityStatus = "available_by_default" | "available" | "occupied" | "closed";
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

  const days: Array<{ date: string | null; inMonth: boolean }> = Array.from(
    { length: first.getUTCDay() },
    () => ({
      date: null,
      inMonth: false,
    })
  );

  while (current.getTime() <= last.getTime()) {
    const date = current.toISOString().slice(0, 10);

    days.push({
      date,
      inMonth: true,
    });

    current.setUTCDate(current.getUTCDate() + 1);
  }

  while (days.length % 7 !== 0 || days.length < 42) {
    days.push({
      date: null,
      inMonth: false,
    });
  }

  return days;
}

export function resolveAvailabilityStatus(
  entry: AuthorizedRoomAvailability | undefined
): AvailabilityStatus {
  if (!entry) {
    return "available_by_default";
  }

  if (entry.closed) {
    return "closed";
  }

  return entry.availableUnits > 0 ? "available" : "occupied";
}

export function getDefaultRoomUnits(units: number) {
  return Number.isInteger(units) && units > 0 ? units : 1;
}

export function normalizeCalendarDayAvailability(
  entry: AuthorizedRoomAvailability | undefined,
  roomUnits: number
) {
  const status = resolveAvailabilityStatus(entry);

  if (!entry) {
    const defaultUnits = getDefaultRoomUnits(roomUnits);

    return {
      status,
      totalUnits: defaultUnits,
      availableUnits: defaultUnits,
      isDefault: true,
    };
  }

  return {
    status,
    totalUnits: entry.totalUnits,
    availableUnits: entry.availableUnits,
    isDefault: false,
  };
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
  roomUnits,
  availableUnits,
  closed,
  note,
}: {
  roomId: string;
  startDate: string;
  endDate: string;
  mode: AvailabilityMode;
  roomUnits: number;
  availableUnits: number;
  closed: boolean;
  note: string;
}): CalendarSavePayload {
  const safeRoomUnits = Number.isInteger(roomUnits) && roomUnits > 0 ? roomUnits : 1;

  if (mode === "closed") {
    return {
      roomId,
      startDate,
      endDate,
      totalUnits: safeRoomUnits,
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
      totalUnits: safeRoomUnits,
      availableUnits: 0,
      closed: false,
      note: note.trim() || undefined,
    };
  }

  const safeAvailableUnits = Math.min(Math.max(availableUnits, 1), safeRoomUnits);

  return {
    roomId,
    startDate,
    endDate,
    totalUnits: safeRoomUnits,
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
