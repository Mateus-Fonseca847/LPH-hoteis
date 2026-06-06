import { beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/lib/prisma";
import { parseHotelRouteParams, requireAuthorizedHotelWrite } from "@/lib/hotel-write";

import { submitHotelForApprovalAction } from "./actions";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers({ "x-real-ip": "127.0.0.1" })),
}));

vi.mock("@/lib/hotel-write", () => ({
  getRequestIpAddress: vi.fn(() => "127.0.0.1"),
  parseHotelRouteParams: vi.fn((value: { hotelId: string }) => ({
    success: true,
    data: value,
  })),
  requireAuthorizedHotelWrite: vi.fn(),
}));

vi.mock("@/lib/validations/hotel", () => ({
  parseHotelFormData: vi.fn(),
  isValidHotelContactEmail: vi.fn((value: string | null | undefined) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? "").trim())
  ),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    hotel: {
      findUnique: vi.fn(),
    },
    hotelAuditLog: {
      create: vi.fn(),
    },
  },
}));

const completeHotel = {
  id: "hotel-1",
  slug: "hotel-1",
  name: "LPH Centro",
  shortDescription: "Hotel urbano.",
  fullDescription: "Hotel urbano completo para reservas.",
  city: "São Paulo",
  state: "SP",
  address: "Rua Central, 100",
  latitude: null,
  longitude: null,
  phone: "(11) 3000-0000",
  email: "hotel@example.com",
  whatsapp: "(11) 99999-0000",
  coverImageUrl: "https://cdn.example.test/capa.webp",
  checkInTime: "14:00",
  checkOutTime: "12:00",
  images: [{ id: "image-1" }],
  amenities: [{ id: "amenity-1" }],
  policies: [{ id: "policy-1" }],
  rooms: [
    {
      id: "room-1",
      rates: [{ id: "rate-1" }],
      availability: [{ id: "availability-1" }],
    },
  ],
};

describe("submitHotelForApprovalAction", () => {
  beforeEach(() => {
    vi.mocked(parseHotelRouteParams).mockClear();
    vi.mocked(requireAuthorizedHotelWrite).mockReset().mockResolvedValue({
      id: "admin-1",
      name: "Admin",
      email: "admin@example.com",
      globalRole: "hotel_admin",
      isActive: true,
    });
    vi.mocked(prisma.hotel.findUnique).mockReset();
    vi.mocked(prisma.hotelAuditLog.create).mockReset();
  });

  it("bloqueia envio sem quartos", async () => {
    vi.mocked(prisma.hotel.findUnique).mockResolvedValue({
      ...completeHotel,
      rooms: [],
    });

    const result = await submitHotelForApprovalAction(
      "hotel-1",
      { status: "idle", message: "" },
      new FormData()
    );

    expect(result.status).toBe("error");
    expect(result.message).toBe(
      "Complete quartos, tarifas e disponibilidade antes de enviar para aprovação."
    );
    expect(prisma.hotelAuditLog.create).not.toHaveBeenCalled();
  });

  it("bloqueia envio sem tarifas", async () => {
    vi.mocked(prisma.hotel.findUnique).mockResolvedValue({
      ...completeHotel,
      rooms: [{ id: "room-1", rates: [], availability: [{ id: "availability-1" }] }],
    });

    const result = await submitHotelForApprovalAction(
      "hotel-1",
      { status: "idle", message: "" },
      new FormData()
    );

    expect(result.status).toBe("error");
    expect(result.message).toBe(
      "Complete quartos, tarifas e disponibilidade antes de enviar para aprovação."
    );
    expect(prisma.hotelAuditLog.create).not.toHaveBeenCalled();
  });

  it("bloqueia envio sem disponibilidade futura", async () => {
    vi.mocked(prisma.hotel.findUnique).mockResolvedValue({
      ...completeHotel,
      rooms: [{ id: "room-1", rates: [{ id: "rate-1" }], availability: [] }],
    });

    const result = await submitHotelForApprovalAction(
      "hotel-1",
      { status: "idle", message: "" },
      new FormData()
    );

    expect(result.status).toBe("error");
    expect(result.message).toBe(
      "Complete quartos, tarifas e disponibilidade antes de enviar para aprovação."
    );
    expect(prisma.hotelAuditLog.create).not.toHaveBeenCalled();
  });

  it("bloqueia envio sem localização suficiente no mapa", async () => {
    vi.mocked(prisma.hotel.findUnique).mockResolvedValue({
      ...completeHotel,
      city: "Cidade Sem Mapa",
      state: "SP",
      latitude: null,
      longitude: null,
    });

    const result = await submitHotelForApprovalAction(
      "hotel-1",
      { status: "idle", message: "" },
      new FormData()
    );

    expect(result.status).toBe("error");
    expect(result.message).toContain("localização no mapa");
    expect(prisma.hotelAuditLog.create).not.toHaveBeenCalled();
  });

  it("cria auditoria quando hotel está completo", async () => {
    vi.mocked(prisma.hotel.findUnique).mockResolvedValue(completeHotel);

    const result = await submitHotelForApprovalAction(
      "hotel-1",
      { status: "idle", message: "" },
      new FormData()
    );

    expect(result).toEqual({
      status: "success",
      message: "Hotel enviado para aprovação.",
    });
    expect(prisma.hotelAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "hotel.approval.submitted",
          hotelId: "hotel-1",
          userId: "admin-1",
        }),
      })
    );
  });
  it("bloqueia envio sem e-mail de contato valido", async () => {
    vi.mocked(prisma.hotel.findUnique).mockResolvedValue({
      ...completeHotel,
      email: "inválido",
    });

    const result = await submitHotelForApprovalAction(
      "hotel-1",
      { status: "idle", message: "" },
      new FormData()
    );

    expect(result).toEqual({
      status: "error",
      message: "Este hotel precisa de um e-mail de contato valido antes de ser aprovado.",
    });
    expect(prisma.hotelAuditLog.create).not.toHaveBeenCalled();
  });
});
