import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  buildCalendarSavePayload,
  getCalendarDays,
  normalizeCalendarDayAvailability,
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
  it("renderiza calendario visual para um quarto", () => {
    const source = readFileSync(new URL("./RoomAvailabilityCalendar.tsx", import.meta.url), "utf8");

    expect(source).toContain("Calendário do quarto");
    expect(source).toContain("roomName");
    expect(source).toContain("defaultUnits");
    expect(source).toContain('aria-label="Mês anterior"');
    expect(source).toContain('aria-label="Próximo mês"');
    expect(source).toContain('{"<"}');
    expect(source).toContain('{">"}');
    expect(source).not.toContain(">Mês anterior<");
    expect(source).not.toContain(">Próximo mês<");
    expect(source).toContain('status === "available_by_default" ? "is-available" : `is-${status}`');
    expect(source).toContain("room-availability-calendar__day-spacer");
    expect(source).toContain("Salvar período");
    expect(source).toContain("Liberar período");
    expect(source).toContain("Selecione um período de até 180 dias.");
    expect(source).toContain("Período marcado como ocupado.");
    expect(source).toContain("Período fechado para reservas.");
    expect(source).toContain("Período liberado para reservas.");
    expect(source).toContain("Não foi possível salvar a disponibilidade.");
  });

  it("mantem a legenda visual de status", () => {
    const source = readFileSync(new URL("./RoomAvailabilityCalendar.tsx", import.meta.url), "utf8");
    const styles = readFileSync(new URL("../../../../styles/globals.css", import.meta.url), "utf8");

    expect(source).toContain("room-availability-calendar__legend");
    expect(source).toContain("Padrão");
    expect(source).toContain("Disponível");
    expect(source).toContain("Ocupado");
    expect(source).toContain("Fechado");
    expect(source).toContain("Selecionado");
    expect(styles).toContain("room-availability-calendar__day.is-available");
    expect(styles).toContain("room-availability-calendar__day.is-occupied");
    expect(styles).toContain("room-availability-calendar__day.is-closed");
    expect(styles).toContain("room-availability-calendar__day.is-selected");
  });

  it("calcula mes anterior e proximo", () => {
    expect(shiftCalendarMonth("2026-06", -1)).toBe("2026-05");
    expect(shiftCalendarMonth("2026-06", 1)).toBe("2026-07");
  });

  it("monta a grade do mes com 7 colunas e celulas vazias", () => {
    const days = getCalendarDays("2026-06");

    expect(days).toHaveLength(42);
    expect(days.slice(0, 7)).toHaveLength(7);
    expect(days[0]).toEqual({ date: null, inMonth: false });
    expect(days[1]).toEqual({ date: "2026-06-01", inMonth: true });
    expect(days.some((day) => day.date === "2026-06-30" && day.inMonth)).toBe(true);
    expect(days.at(-1)).toEqual({ date: null, inMonth: false });
  });

  it("seleciona intervalo e inverte quando a segunda data e anterior", () => {
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
      roomUnits: 2,
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
      roomUnits: 2,
      availableUnits: 2,
      closed: false,
      note: "",
    });

    expect(payload.closed).toBe(true);
    expect(payload.availableUnits).toBe(0);
  });

  it("disponivel salva closed false e availableUnits maior que zero", () => {
    const payload = buildCalendarSavePayload({
      roomId,
      startDate: "2026-06-10",
      endDate: "2026-06-12",
      mode: "available",
      roomUnits: 1,
      availableUnits: 0,
      closed: false,
      note: "",
    });

    expect(payload.closed).toBe(false);
    expect(payload.availableUnits).toBeGreaterThan(0);
    expect(payload.totalUnits).toBeGreaterThanOrEqual(payload.availableUnits);
  });

  it("usa o roomId recebido e nao afeta outros quartos", () => {
    const payload = buildCalendarSavePayload({
      roomId: "room_target_123456",
      startDate: "2026-06-10",
      endDate: "2026-06-12",
      mode: "available",
      roomUnits: 3,
      availableUnits: 1,
      closed: false,
      note: "ok",
    });

    expect(payload.roomId).toBe("room_target_123456");
    expect(payload.roomId).not.toBe("room_other_123456");
  });

  it("resolve status visual dos dias", () => {
    expect(resolveAvailabilityStatus(undefined)).toBe("available_by_default");
    expect(resolveAvailabilityStatus(availability[0])).toBe("available");
    expect(resolveAvailabilityStatus(availability[1])).toBe("occupied");
    expect(resolveAvailabilityStatus(availability[2])).toBe("closed");
  });

  it("normaliza dia sem registro como disponivel por padrao", () => {
    expect(normalizeCalendarDayAvailability(undefined, 1)).toMatchObject({
      status: "available_by_default",
      totalUnits: 1,
      availableUnits: 1,
      isDefault: true,
    });
    expect(normalizeCalendarDayAvailability(undefined, 4)).toMatchObject({
      status: "available_by_default",
      totalUnits: 4,
      availableUnits: 4,
      isDefault: true,
    });
  });

  it("preserva ocupado, fechado e disponivel cadastrados", () => {
    expect(normalizeCalendarDayAvailability(availability[0], 4)).toMatchObject({
      status: "available",
      totalUnits: 2,
      availableUnits: 1,
      isDefault: false,
    });
    expect(normalizeCalendarDayAvailability(availability[1], 4)).toMatchObject({
      status: "occupied",
      availableUnits: 0,
      isDefault: false,
    });
    expect(normalizeCalendarDayAvailability(availability[2], 4)).toMatchObject({
      status: "closed",
      availableUnits: 0,
      isDefault: false,
    });
  });

  it("usa unidades do quarto como total ao liberar periodo", () => {
    const payload = buildCalendarSavePayload({
      roomId,
      startDate: "2026-06-10",
      endDate: "2026-06-12",
      mode: "available",
      roomUnits: 4,
      availableUnits: 4,
      closed: false,
      note: "",
    });

    expect(payload.totalUnits).toBe(4);
    expect(payload.availableUnits).toBe(4);
    expect(payload.closed).toBe(false);
  });

  it("usa unidades do quarto como total ao ocupar periodo", () => {
    const payload = buildCalendarSavePayload({
      roomId,
      startDate: "2026-06-10",
      endDate: "2026-06-12",
      mode: "occupied",
      roomUnits: 4,
      availableUnits: 4,
      closed: true,
      note: "",
    });

    expect(payload.totalUnits).toBe(4);
    expect(payload.availableUnits).toBe(0);
    expect(payload.closed).toBe(false);
  });

  it("usa unidades do quarto como total ao fechar periodo", () => {
    const payload = buildCalendarSavePayload({
      roomId,
      startDate: "2026-06-10",
      endDate: "2026-06-12",
      mode: "closed",
      roomUnits: 4,
      availableUnits: 4,
      closed: false,
      note: "",
    });

    expect(payload.totalUnits).toBe(4);
    expect(payload.availableUnits).toBe(0);
    expect(payload.closed).toBe(true);
  });

  it("limita unidades disponiveis ao total do quarto", () => {
    const payload = buildCalendarSavePayload({
      roomId,
      startDate: "2026-06-10",
      endDate: "2026-06-12",
      mode: "available",
      roomUnits: 3,
      availableUnits: 5,
      closed: false,
      note: "",
    });

    expect(payload.totalUnits).toBe(3);
    expect(payload.availableUnits).toBe(3);
  });
});
