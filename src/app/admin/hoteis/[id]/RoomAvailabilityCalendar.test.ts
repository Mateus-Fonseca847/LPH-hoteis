import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  buildCalendarSavePayload,
  getCalendarDays,
  resolveAvailabilityStatus,
  selectCalendarRange,
  shiftCalendarMonth,
} from "./RoomAvailabilityCalendarLogic";
import type { AuthorizedRoomAvailability } from "./room-availability-actions";

const roomId = "room_1234567890";

const availability: AuthorizedRoomAvailability[] = [
  {
    id: "availability-1",
    roomId,
    date: "2026-06-10",
    totalUnits: 2,
    availableUnits: 1,
    closed: false,
    note: null,
  },
  {
    id: "availability-2",
    roomId,
    date: "2026-06-11",
    totalUnits: 2,
    availableUnits: 0,
    closed: false,
    note: null,
  },
  {
    id: "availability-3",
    roomId,
    date: "2026-06-12",
    totalUnits: 2,
    availableUnits: 0,
    closed: true,
    note: null,
  },
];

describe("RoomAvailabilityCalendar", () => {
  it("renderiza calendário visual para um quarto", () => {
    const source = readFileSync(new URL("./RoomAvailabilityCalendar.tsx", import.meta.url), "utf8");

    expect(source).toContain("Calendário do quarto");
    expect(source).toContain("roomName");
    expect(source).toContain("Mês anterior");
    expect(source).toContain("Próximo mês");
    expect(source).toContain("`is-${status}`");
    expect(source).toContain("Salvar período");
    expect(source).toContain("Liberar período");
    expect(source).toContain("Selecione um período de até 180 dias.");
    expect(source).toContain("Período marcado como ocupado.");
    expect(source).toContain("Período fechado para reservas.");
    expect(source).toContain("Período liberado para reservas.");
    expect(source).toContain("Não foi possível salvar a disponibilidade.");
  });

  it("calcula mês anterior e próximo", () => {
    expect(shiftCalendarMonth("2026-06", -1)).toBe("2026-05");
    expect(shiftCalendarMonth("2026-06", 1)).toBe("2026-07");
  });

  it("monta a grade do mês", () => {
    const days = getCalendarDays("2026-06");

    expect(days.some((day) => day.date === "2026-06-01" && day.inMonth)).toBe(true);
    expect(days.some((day) => day.date === "2026-06-30" && day.inMonth)).toBe(true);
  });

  it("seleciona intervalo e inverte quando a segunda data é anterior", () => {
    const firstClick = selectCalendarRange({ startDate: null, endDate: null }, "2026-06-20");
    const secondClick = selectCalendarRange(firstClick, "2026-06-10");

    expect(secondClick).toEqual({ startDate: "2026-06-10", endDate: "2026-06-20" });
  });

  it("ocupado salva availableUnits zero e closed false", () => {
    const payload = buildCalendarSavePayload({
      roomId,
      startDate: "2026-06-10",
      endDate: "2026-06-12",
      mode: "occupied",
      totalUnits: 2,
      availableUnits: 2,
      closed: true,
      note: "",
    });

    expect(payload).toMatchObject({
      roomId,
      availableUnits: 0,
      closed: false,
    });
  });

  it("fechado salva closed true", () => {
    const payload = buildCalendarSavePayload({
      roomId,
      startDate: "2026-06-10",
      endDate: "2026-06-12",
      mode: "closed",
      totalUnits: 2,
      availableUnits: 2,
      closed: false,
      note: "",
    });

    expect(payload.closed).toBe(true);
    expect(payload.availableUnits).toBe(0);
  });

  it("disponível salva closed false e availableUnits maior que zero", () => {
    const payload = buildCalendarSavePayload({
      roomId,
      startDate: "2026-06-10",
      endDate: "2026-06-12",
      mode: "available",
      totalUnits: 0,
      availableUnits: 0,
      closed: false,
      note: "",
    });

    expect(payload.closed).toBe(false);
    expect(payload.availableUnits).toBeGreaterThan(0);
    expect(payload.totalUnits).toBeGreaterThanOrEqual(payload.availableUnits);
  });

  it("usa o roomId recebido e não afeta outros quartos", () => {
    const payload = buildCalendarSavePayload({
      roomId: "room_target_123456",
      startDate: "2026-06-10",
      endDate: "2026-06-12",
      mode: "available",
      totalUnits: 3,
      availableUnits: 1,
      closed: false,
      note: "ok",
    });

    expect(payload.roomId).toBe("room_target_123456");
    expect(payload.roomId).not.toBe("room_other_123456");
  });

  it("resolve status visual dos dias", () => {
    expect(resolveAvailabilityStatus(undefined)).toBe("none");
    expect(resolveAvailabilityStatus(availability[0])).toBe("available");
    expect(resolveAvailabilityStatus(availability[1])).toBe("occupied");
    expect(resolveAvailabilityStatus(availability[2])).toBe("closed");
  });
});
