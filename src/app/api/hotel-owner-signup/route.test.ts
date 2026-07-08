import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/hotel-owner-signup/route";
import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/prisma";

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

vi.mock("@/lib/auth/password", () => ({
  hashPassword: vi.fn(),
}));

function createRequest(payload: unknown = validPayload) {
  return new Request("http://localhost/api/hotel-owner-signup", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

const validPayload = {
  responsibleName: "Maria Oliveira",
  email: "maria@hotel.com",
  phone: "(11) 99999-0000",
  hotelName: "Hotel Central",
  hotelCity: "São Paulo",
  hotelState: "SP",
  hotelDocument: "12.345.678/0001-95",
  message: "Quero cadastrar meu hotel na plataforma.",
  password: "senha123",
  confirmPassword: "senha123",
};

describe("POST /api/hotel-owner-signup", () => {
  beforeEach(() => {
    vi.mocked(prisma.user.findUnique).mockReset();
    vi.mocked(prisma.user.create).mockReset();
    vi.mocked(prisma.hotel.create).mockReset();
    vi.mocked(prisma.hotelPermission.create).mockReset();
    vi.mocked(prisma.hotelOwnerSignupRequest.findFirst).mockReset();
    vi.mocked(prisma.hotelOwnerSignupRequest.create).mockReset();
    vi.mocked(hashPassword).mockReset().mockResolvedValue("hashed-signup-password");

    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.hotelOwnerSignupRequest.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.hotelOwnerSignupRequest.create).mockResolvedValue({
      id: "request-1",
      status: "pending",
    } as never);
  });

  it("salva HotelOwnerSignupRequest com status pending", async () => {
    const response = await POST(createRequest());
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.request).toEqual({
      id: "request-1",
      status: "pending",
    });
    expect(JSON.stringify(body)).not.toContain("passwordHash");
    expect(JSON.stringify(body)).not.toContain(validPayload.password);
    expect(JSON.stringify(body)).not.toContain(validPayload.confirmPassword);
    expect(prisma.hotelOwnerSignupRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: "maria@hotel.com",
          passwordHash: "hashed-signup-password",
          status: "pending",
        }),
      })
    );
  });

  it("bloqueia solicitação sem senha", async () => {
    const response = await POST(
      createRequest({
        ...validPayload,
        password: "",
        confirmPassword: "",
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Informe a senha.");
    expect(prisma.hotelOwnerSignupRequest.create).not.toHaveBeenCalled();
  });

  it("não cria User, Hotel, HotelPermission ou sessão", async () => {
    await POST(createRequest());

    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.hotel.create).not.toHaveBeenCalled();
    expect(prisma.hotelPermission.create).not.toHaveBeenCalled();
  });

  it("bloqueia e-mail já existente em User", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "user-1" } as never);

    const response = await POST(createRequest());
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toBe("Já existe usuário com este e-mail.");
    expect(prisma.hotelOwnerSignupRequest.create).not.toHaveBeenCalled();
  });

  it("bloqueia solicitação pending duplicada", async () => {
    vi.mocked(prisma.hotelOwnerSignupRequest.findFirst).mockResolvedValue({
      id: "request-existing",
    } as never);

    const response = await POST(createRequest());
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toBe("Já existe uma solicitação pendente para este e-mail.");
    expect(prisma.hotelOwnerSignupRequest.create).not.toHaveBeenCalled();
  });

  it("bloqueia campos obrigatórios ausentes", async () => {
    const response = await POST(
      createRequest({
        ...validPayload,
        responsibleName: "",
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("VALIDATION_ERROR");
    expect(prisma.hotelOwnerSignupRequest.create).not.toHaveBeenCalled();
  });
});
