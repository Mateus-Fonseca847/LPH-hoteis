import { beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/lib/prisma";
import { requireAuthenticatedRequestUser } from "@/lib/auth";
import { parseHotelRouteParams, requireAuthorizedHotelWrite } from "@/lib/hotel-write";

import { approveHotelAction, submitHotelForApprovalAction } from "./actions";

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

vi.mock("@/lib/auth", () => ({
  requireAuthenticatedRequestUser: vi.fn(),
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
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

const completeHotel = {
  id: "hotel-1",
  slug: "hotel-1",
  isPublished: false,
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
    vi.mocked(prisma.hotelAuditLog.findFirst).mockReset();
    vi.mocked(prisma.hotelAuditLog.create).mockReset();
    vi.mocked(prisma.$transaction).mockReset();
    vi.mocked(requireAuthenticatedRequestUser).mockReset();
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
    expect(result.message).toBe("Complete quartos e tarifas antes de enviar para aprovação.");
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
    expect(result.message).toBe("Complete quartos e tarifas antes de enviar para aprovação.");
    expect(prisma.hotelAuditLog.create).not.toHaveBeenCalled();
  });

  it("permite envio sem disponibilidade futura", async () => {
    vi.mocked(prisma.hotel.findUnique).mockResolvedValue({
      ...completeHotel,
      rooms: [{ id: "room-1", rates: [{ id: "rate-1" }], availability: [] }],
    });

    const result = await submitHotelForApprovalAction(
      "hotel-1",
      { status: "idle", message: "" },
      new FormData()
    );

    expect(result).toEqual({
      status: "success",
      message: "Hotel enviado para aprovação.",
    });
    expect(prisma.hotelAuditLog.create).toHaveBeenCalled();
  });

  it("permite envio sem localização suficiente no mapa", async () => {
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

    expect(result).toEqual({
      status: "success",
      message: "Hotel enviado para aprovação.",
    });
    expect(prisma.hotelAuditLog.create).toHaveBeenCalled();
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

describe("approveHotelAction", () => {
  beforeEach(() => {
    vi.mocked(parseHotelRouteParams).mockClear();
    vi.mocked(requireAuthenticatedRequestUser).mockReset().mockResolvedValue({
      id: "super-1",
      name: "Super",
      email: "super@example.com",
      globalRole: "super_admin",
      isActive: true,
    });
    vi.mocked(prisma.hotel.findUnique).mockReset().mockResolvedValue(completeHotel);
    vi.mocked(prisma.hotelAuditLog.findFirst).mockReset().mockResolvedValue({ id: "submission-1" });
    vi.mocked(prisma.hotelAuditLog.create).mockReset();
    vi.mocked(prisma.$transaction)
      .mockReset()
      .mockImplementation(async (callback) =>
        callback({
          hotel: {
            update: vi.fn(),
          },
          hotelAuditLog: {
            create: vi.fn(),
          },
        })
      );
  });

  it("bloqueia aprovação por hotel_admin", async () => {
    vi.mocked(requireAuthenticatedRequestUser).mockResolvedValue({
      id: "admin-1",
      name: "Admin",
      email: "admin@example.com",
      globalRole: "hotel_admin",
      isActive: true,
    });

    const result = await approveHotelAction(
      "hotel-1",
      { status: "idle", message: "" },
      new FormData()
    );

    expect(result).toEqual({
      status: "error",
      message: "Apenas o super administrador pode aprovar e publicar hotéis.",
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("bloqueia aprovação antes do envio para aprovação", async () => {
    vi.mocked(prisma.hotelAuditLog.findFirst).mockResolvedValue(null);

    const result = await approveHotelAction(
      "hotel-1",
      { status: "idle", message: "" },
      new FormData()
    );

    expect(result).toEqual({
      status: "error",
      message: "Hotel ainda não foi enviado para aprovação.",
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("retorna mensagem específica se faltar tarifa ativa", async () => {
    vi.mocked(prisma.hotel.findUnique).mockResolvedValue({
      ...completeHotel,
      rooms: [{ id: "room-1", rates: [], availability: [{ id: "availability-1" }] }],
    });

    const result = await approveHotelAction(
      "hotel-1",
      { status: "idle", message: "" },
      new FormData()
    );

    expect(result).toEqual({
      status: "error",
      message: "Cadastre pelo menos uma tarifa ativa antes de publicar.",
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("publica mesmo sem disponibilidade futura e sem localização no mapa", async () => {
    vi.mocked(prisma.hotel.findUnique).mockResolvedValue({
      ...completeHotel,
      city: "Cidade Sem Mapa",
      state: "SP",
      latitude: null,
      longitude: null,
      rooms: [{ id: "room-1", rates: [{ id: "rate-1" }], availability: [] }],
    });

    const result = await approveHotelAction(
      "hotel-1",
      { status: "idle", message: "" },
      new FormData()
    );

    expect(result).toEqual({
      status: "success",
      message: "Hotel aprovado e publicado.",
    });
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it("super_admin aprova e publica hotel pendente", async () => {
    const update = vi.fn();
    const create = vi.fn();
    vi.mocked(prisma.$transaction).mockImplementation(async (callback) =>
      callback({
        hotel: {
          update,
        },
        hotelAuditLog: {
          create,
        },
      })
    );

    const result = await approveHotelAction(
      "hotel-1",
      { status: "idle", message: "" },
      new FormData()
    );

    expect(result).toEqual({
      status: "success",
      message: "Hotel aprovado e publicado.",
    });
    expect(update).toHaveBeenCalledWith({
      where: {
        id: "hotel-1",
      },
      data: {
        isPublished: true,
      },
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "hotel.approval.published",
          hotelId: "hotel-1",
          userId: "super-1",
        }),
      })
    );
  });
});
