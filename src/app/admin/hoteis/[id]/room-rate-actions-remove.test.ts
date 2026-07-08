import { beforeEach, describe, expect, it, vi } from "vitest";

import { createRoomRateAuditLog } from "@/lib/audit/room-rate-audit";
import { AuthorizationError, NotFoundError } from "@/lib/errors/app-error";
import { requireAuthorizedHotelWrite } from "@/lib/hotel-write";
import { prisma } from "@/lib/prisma";

import { removeRoomRateAction } from "./room-rate-actions";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers({ "x-real-ip": "127.0.0.1" })),
}));

vi.mock("@/lib/hotel-write", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/hotel-write")>();

  return {
    ...actual,
    requireAuthorizedHotelWrite: vi.fn(),
  };
});

vi.mock("@/lib/audit/room-rate-audit", () => ({
  createRoomRateAuditLog: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    hotelRoom: {
      findFirst: vi.fn(),
    },
    roomRate: {
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

const hotelId = "hotel_123456";
const roomId = "room_1234567";
const rateId = "rate_1234567";

const room = {
  id: roomId,
  hotel: {
    id: hotelId,
    slug: "hotel-teste",
  },
};

const rate = {
  id: rateId,
  roomId,
  name: "Tarifa flexível",
  description: "Tarifa teste.",
  priceCents: 35000,
  currency: "BRL",
  startDate: new Date("2026-07-01T00:00:00.000Z"),
  endDate: new Date("2026-07-31T00:00:00.000Z"),
  minNights: 1,
  maxGuests: 2,
  refundable: true,
  breakfastIncluded: false,
  isActive: true,
};

describe("removeRoomRateAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.hotelRoom.findFirst).mockResolvedValue(room as never);
    vi.mocked(prisma.roomRate.findFirst).mockResolvedValue(rate);
  });

  it.each(["super_admin", "hotel_admin"] as const)(
    "%s autorizado remove a tarifa e registra auditoria",
    async (globalRole) => {
      const deleteRate = vi.fn();
      vi.mocked(requireAuthorizedHotelWrite).mockResolvedValue({
        id: `${globalRole}_123`,
        globalRole,
      } as never);
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) =>
        callback({ roomRate: { delete: deleteRate } } as never)
      );

      await expect(removeRoomRateAction(hotelId, roomId, rateId)).resolves.toEqual({
        status: "success",
        message: "Tarifa removida com sucesso.",
        rateId,
      });
      expect(deleteRate).toHaveBeenCalledWith({ where: { id: rateId } });
      expect(createRoomRateAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "hotel.room_rate.removed",
          hotelId,
          newValue: null,
        })
      );
    }
  );

  it.each([new AuthorizationError(), new NotFoundError()])(
    "nega usuário sem permissão no hotel",
    async (error) => {
      vi.mocked(requireAuthorizedHotelWrite).mockRejectedValue(error);

      await expect(removeRoomRateAction(hotelId, roomId, rateId)).resolves.toEqual({
        status: "error",
        message: "Você não tem permissão para remover esta tarifa.",
      });
      expect(prisma.hotelRoom.findFirst).not.toHaveBeenCalled();
    }
  );

  it("retorna erro claro para tarifa inexistente", async () => {
    vi.mocked(requireAuthorizedHotelWrite).mockResolvedValue({
      id: "super_admin_123",
      globalRole: "super_admin",
    } as never);
    vi.mocked(prisma.roomRate.findFirst).mockResolvedValue(null);

    await expect(removeRoomRateAction(hotelId, roomId, rateId)).resolves.toEqual({
      status: "error",
      message: "Tarifa não encontrada.",
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
