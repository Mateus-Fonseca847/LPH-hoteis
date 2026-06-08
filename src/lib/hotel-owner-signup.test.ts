import { beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/lib/prisma";
import {
  createPendingHotelOwnerSignupRequest,
  HOTEL_OWNER_SIGNUP_PENDING_EXISTS_MESSAGE,
  HOTEL_OWNER_SIGNUP_USER_EXISTS_MESSAGE,
} from "@/lib/hotel-owner-signup";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    hotel: {
      create: vi.fn(),
    },
    hotelPermission: {
      create: vi.fn(),
    },
    hotelOwnerSignupRequest: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}));

const validPayload = {
  responsibleName: "Maria Oliveira",
  email: "maria@hotel.com",
  phone: "(11) 99999-0000",
  hotelName: "Hotel Central",
  hotelCity: "São Paulo",
  hotelState: "SP",
  hotelDocument: "12.345.678/0001-90",
  message: "Quero cadastrar meu hotel na plataforma.",
};

describe("hotel owner signup requests", () => {
  beforeEach(() => {
    vi.mocked(prisma.user.findUnique).mockReset();
    vi.mocked(prisma.user.create).mockReset();
    vi.mocked(prisma.hotel.create).mockReset();
    vi.mocked(prisma.hotelPermission.create).mockReset();
    vi.mocked(prisma.hotelOwnerSignupRequest.findFirst).mockReset();
    vi.mocked(prisma.hotelOwnerSignupRequest.create).mockReset();

    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.hotelOwnerSignupRequest.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.hotelOwnerSignupRequest.create).mockResolvedValue({
      id: "request-1",
      status: "pending",
    } as never);
  });

  it("cria solicitação pending válida", async () => {
    const result = await createPendingHotelOwnerSignupRequest(validPayload);

    expect(result).toEqual({
      id: "request-1",
      status: "pending",
    });
    expect(prisma.hotelOwnerSignupRequest.create).toHaveBeenCalledWith({
      data: {
        ...validPayload,
        email: "maria@hotel.com",
        hotelState: "SP",
        status: "pending",
      },
      select: {
        id: true,
        status: true,
      },
    });
  });

  it("bloqueia e-mail já existente em User", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "user-1" } as never);

    await expect(createPendingHotelOwnerSignupRequest(validPayload)).rejects.toThrow(
      HOTEL_OWNER_SIGNUP_USER_EXISTS_MESSAGE
    );
    expect(prisma.hotelOwnerSignupRequest.create).not.toHaveBeenCalled();
  });

  it("bloqueia solicitação pending duplicada", async () => {
    vi.mocked(prisma.hotelOwnerSignupRequest.findFirst).mockResolvedValue({
      id: "request-existing",
    } as never);

    await expect(createPendingHotelOwnerSignupRequest(validPayload)).rejects.toThrow(
      HOTEL_OWNER_SIGNUP_PENDING_EXISTS_MESSAGE
    );
    expect(prisma.hotelOwnerSignupRequest.create).not.toHaveBeenCalled();
  });

  it("não cria User, Hotel ou HotelPermission ao solicitar cadastro", async () => {
    await createPendingHotelOwnerSignupRequest(validPayload);

    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.hotel.create).not.toHaveBeenCalled();
    expect(prisma.hotelPermission.create).not.toHaveBeenCalled();
  });

  it("status inicial é pending", async () => {
    await createPendingHotelOwnerSignupRequest(validPayload);

    expect(prisma.hotelOwnerSignupRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "pending",
        }),
      })
    );
  });
});
