import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  approveHotelOwnerSignupRequestAction,
  rejectHotelOwnerSignupRequestAction,
} from "./actions";
import { requireAuthenticatedRequestUser } from "@/lib/auth";
import { sendHotelOwnerSignupApprovedEmail, sendHotelOwnerSignupRejectedEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireAuthenticatedRequestUser: vi.fn(),
}));

vi.mock("@/lib/email", () => ({
  sendHotelOwnerSignupApprovedEmail: vi.fn(),
  sendHotelOwnerSignupRejectedEmail: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
    hotelPermission: {
      create: vi.fn(),
    },
  },
}));

const pendingRequest = {
  id: "request-1",
  responsibleName: "Maria Oliveira",
  email: "maria@hotel.com",
  hotelName: "Hotel Central",
  passwordHash: "stored-signup-password-hash",
  status: "pending",
};

function formData(note = "Cadastro validado.") {
  const data = new FormData();
  data.set("reviewNote", note);
  return data;
}

function mockSuperAdmin() {
  vi.mocked(requireAuthenticatedRequestUser).mockResolvedValue({
    id: "super-1",
    globalRole: "super_admin",
    isActive: true,
  } as never);
}

function mockHotelAdmin() {
  vi.mocked(requireAuthenticatedRequestUser).mockResolvedValue({
    id: "hotel-admin-1",
    globalRole: "hotel_admin",
    isActive: true,
  } as never);
}

describe("hotel owner signup review actions", () => {
  beforeEach(() => {
    vi.mocked(requireAuthenticatedRequestUser).mockReset();
    vi.mocked(sendHotelOwnerSignupApprovedEmail).mockReset().mockResolvedValue(undefined);
    vi.mocked(sendHotelOwnerSignupRejectedEmail).mockReset().mockResolvedValue(undefined);
    vi.mocked(prisma.$transaction).mockReset();
    vi.mocked(prisma.hotelPermission.create).mockReset();
  });

  it("super_admin rejeita solicitação pending sem criar User", async () => {
    mockSuperAdmin();

    const tx = {
      hotelOwnerSignupRequest: {
        findUnique: vi.fn().mockResolvedValue(pendingRequest),
        update: vi.fn().mockResolvedValue({
          email: pendingRequest.email,
          responsibleName: pendingRequest.responsibleName,
          hotelName: pendingRequest.hotelName,
        }),
      },
      user: {
        create: vi.fn(),
      },
    };

    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => callback(tx as never));

    const result = await rejectHotelOwnerSignupRequestAction(
      "request-1",
      {
        status: "idle",
        message: "",
      },
      formData("Sem documentação suficiente.")
    );

    expect(result.status).toBe("success");
    expect(tx.hotelOwnerSignupRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "rejected",
          reviewedById: "super-1",
          reviewNote: "Sem documentação suficiente.",
        }),
      })
    );
    expect(tx.user.create).not.toHaveBeenCalled();
    expect(sendHotelOwnerSignupRejectedEmail).toHaveBeenCalled();
  });

  it("super_admin aprova pending e cria User hotel_admin", async () => {
    mockSuperAdmin();

    const tx = {
      hotelOwnerSignupRequest: {
        findUnique: vi.fn().mockResolvedValue(pendingRequest),
        update: vi.fn().mockResolvedValue({
          email: pendingRequest.email,
          responsibleName: pendingRequest.responsibleName,
          hotelName: pendingRequest.hotelName,
          createdUserId: "user-1",
        }),
      },
      user: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({
          id: "user-1",
          email: pendingRequest.email,
          name: pendingRequest.responsibleName,
          globalRole: "hotel_admin",
        }),
      },
    };

    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => callback(tx as never));

    const result = await approveHotelOwnerSignupRequestAction(
      "request-1",
      {
        status: "idle",
        message: "",
      },
      formData()
    );

    expect(result.status).toBe("success");
    expect(tx.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          globalRole: "hotel_admin",
          isActive: true,
          emailTwoFactorEnabled: false,
          passwordHash: "stored-signup-password-hash",
        }),
      })
    );
    expect(tx.user.create).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          globalRole: "super_admin",
        }),
      })
    );
    expect(tx.hotelOwnerSignupRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "approved",
          reviewedById: "super-1",
          createdUserId: "user-1",
        }),
      })
    );
    expect(prisma.hotelPermission.create).not.toHaveBeenCalled();
    expect(sendHotelOwnerSignupApprovedEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: pendingRequest.email,
      })
    );
    expect(sendHotelOwnerSignupApprovedEmail).not.toHaveBeenCalledWith(
      expect.objectContaining({
        temporaryPassword: expect.any(String),
      })
    );
    expect(JSON.stringify(vi.mocked(sendHotelOwnerSignupApprovedEmail).mock.calls)).not.toContain(
      "stored-signup-password-hash"
    );
  });

  it("não aprova solicitação antiga sem passwordHash", async () => {
    mockSuperAdmin();

    const tx = {
      hotelOwnerSignupRequest: {
        findUnique: vi.fn().mockResolvedValue({
          ...pendingRequest,
          passwordHash: null,
        }),
      },
      user: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
    };

    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => callback(tx as never));

    const result = await approveHotelOwnerSignupRequestAction(
      "request-1",
      {
        status: "idle",
        message: "",
      },
      formData()
    );

    expect(result.status).toBe("error");
    expect(result.message).toContain("Esta solicitação não possui senha definida");
    expect(tx.user.findUnique).not.toHaveBeenCalled();
    expect(tx.user.create).not.toHaveBeenCalled();
  });

  it("aprovação não cria usuário duplicado", async () => {
    mockSuperAdmin();

    const tx = {
      hotelOwnerSignupRequest: {
        findUnique: vi.fn().mockResolvedValue(pendingRequest),
      },
      user: {
        findUnique: vi.fn().mockResolvedValue({ id: "existing-user" }),
        create: vi.fn(),
      },
    };

    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => callback(tx as never));

    const result = await approveHotelOwnerSignupRequestAction(
      "request-1",
      {
        status: "idle",
        message: "",
      },
      formData()
    );

    expect(result.status).toBe("error");
    expect(result.message).toContain("Já existe usuário");
    expect(tx.user.create).not.toHaveBeenCalled();
  });

  it("hotel_admin não aprova nem rejeita solicitações", async () => {
    mockHotelAdmin();

    const approveResult = await approveHotelOwnerSignupRequestAction(
      "request-1",
      {
        status: "idle",
        message: "",
      },
      formData()
    );
    const rejectResult = await rejectHotelOwnerSignupRequestAction(
      "request-1",
      {
        status: "idle",
        message: "",
      },
      formData()
    );

    expect(approveResult.status).toBe("error");
    expect(rejectResult.status).toBe("error");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
