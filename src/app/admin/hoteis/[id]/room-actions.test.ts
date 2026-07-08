import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireAuthorizedHotelWrite } from "@/lib/hotel-write";
import { prisma } from "@/lib/prisma";

import { createHotelRoomAction, updateHotelRoomAction } from "./room-actions";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers({ "x-real-ip": "127.0.0.1" })),
}));

vi.mock("@/lib/audit/hotel-room-audit", () => ({
  createHotelRoomAuditLog: vi.fn(),
}));

vi.mock("@/lib/hotel-write", async () => {
  const actual = await vi.importActual<typeof import("@/lib/hotel-write")>("@/lib/hotel-write");

  return {
    ...actual,
    requireAuthorizedHotelWrite: vi.fn(),
    getRequestIpAddress: vi.fn(() => "127.0.0.1"),
  };
});

vi.mock("@/lib/uploads/hotel-images", () => ({
  deleteStoredHotelImageFile: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    hotel: {
      findUnique: vi.fn(),
    },
    hotelRoom: {
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

const hotelId = "hotel_123456";
const roomId = "room_123456";

const validRoomPayload = {
  name: "Quarto Standard",
  description: "Quarto confortavel com estrutura completa.",
  imageUrl: "https://cdn.example.test/standard.webp",
  images: [
    {
      url: "https://cdn.example.test/standard.webp",
      alt: "Quarto Standard",
      position: 0,
    },
  ],
  units: 1,
  capacityAdults: 2,
  capacityChildren: 0,
  beds: "1x Cama queen",
  sizeM2: 25,
  amenities: ["Wi-Fi no quarto"],
  isActive: true,
};

const existingRoom = {
  id: roomId,
  ...validRoomPayload,
  capacity: 2,
  size: "25 m2",
  priceFrom: { toString: () => "0" },
  isAvailable: true,
};

function buildTx() {
  return {
    hotelRoom: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        id: roomId,
        ...data,
      })),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        ...existingRoom,
        ...data,
      })),
    },
    hotelRoomImage: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
  };
}

describe("hotel room actions", () => {
  beforeEach(() => {
    vi.mocked(requireAuthorizedHotelWrite).mockReset().mockResolvedValue({
      id: "admin-1",
      name: "Admin",
      email: "admin@example.com",
      globalRole: "hotel_admin",
      isActive: true,
    });
    vi.mocked(prisma.hotel.findUnique).mockReset().mockResolvedValue({
      id: hotelId,
      slug: "hotel-1",
      name: "Hotel",
    });
    vi.mocked(prisma.hotelRoom.findFirst).mockReset().mockResolvedValue(existingRoom);
    vi.mocked(prisma.$transaction).mockReset();
  });

  it("cria quarto com units = 1", async () => {
    const tx = buildTx();
    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => callback(tx as never));

    await expect(createHotelRoomAction(hotelId, validRoomPayload)).resolves.toMatchObject({
      status: "success",
      roomId,
    });

    expect(tx.hotelRoom.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          units: 1,
        }),
      })
    );
  });

  it("cria quarto com units = 4", async () => {
    const tx = buildTx();
    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => callback(tx as never));

    await createHotelRoomAction(hotelId, { ...validRoomPayload, units: 4 });

    expect(tx.hotelRoom.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          units: 4,
        }),
      })
    );
  });

  it("nao cria quarto com units = 0", async () => {
    await expect(
      createHotelRoomAction(hotelId, { ...validRoomPayload, units: 0 })
    ).resolves.toEqual(
      expect.objectContaining({
        status: "error",
      })
    );

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("nao cria quarto com units negativo", async () => {
    await expect(
      createHotelRoomAction(hotelId, { ...validRoomPayload, units: -1 })
    ).resolves.toEqual(
      expect.objectContaining({
        status: "error",
      })
    );

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("edita units do quarto", async () => {
    const tx = buildTx();
    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => callback(tx as never));

    await expect(updateHotelRoomAction(hotelId, roomId, { units: 2 })).resolves.toMatchObject({
      status: "success",
      roomId,
    });

    expect(tx.hotelRoom.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          units: 2,
        }),
      })
    );
  });
});
