import { beforeEach, describe, expect, it, vi } from "vitest";

import { hashPassword } from "@/lib/auth/password";
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

vi.mock("@/lib/auth/password", () => ({
  hashPassword: vi.fn(),
}));

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

describe("hotel owner signup requests", () => {
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

  it("cria solicitação pending válida", async () => {
    const result = await createPendingHotelOwnerSignupRequest(validPayload);

    expect(result).toEqual({
      id: "request-1",
      status: "pending",
    });
    expect(prisma.hotelOwnerSignupRequest.create).toHaveBeenCalledWith({
      data: {
        responsibleName: "Maria Oliveira",
        email: "maria@hotel.com",
        phone: "(11) 99999-0000",
        hotelName: "Hotel Central",
        hotelCity: "São Paulo",
        hotelState: "SP",
        hotelDocument: "12345678000195",
        message: "Quero cadastrar meu hotel na plataforma.",
        passwordHash: "hashed-signup-password",
        status: "pending",
      },
      select: {
        id: true,
        status: true,
      },
    });
    expect(prisma.hotelOwnerSignupRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({
          password: expect.any(String),
          confirmPassword: expect.any(String),
        }),
      })
    );
  });

  it("falha sem senha", async () => {
    await expect(
      createPendingHotelOwnerSignupRequest({
        ...validPayload,
        password: "",
        confirmPassword: "",
      })
    ).rejects.toThrow("Informe a senha.");
    expect(prisma.hotelOwnerSignupRequest.create).not.toHaveBeenCalled();
  });

  it("falha com senha curta", async () => {
    await expect(
      createPendingHotelOwnerSignupRequest({
        ...validPayload,
        password: "a1",
        confirmPassword: "a1",
      })
    ).rejects.toThrow("A senha deve ter pelo menos 8 caracteres.");
    expect(prisma.hotelOwnerSignupRequest.create).not.toHaveBeenCalled();
  });

  it("falha com senha sem número", async () => {
    await expect(
      createPendingHotelOwnerSignupRequest({
        ...validPayload,
        password: "senhaforte",
        confirmPassword: "senhaforte",
      })
    ).rejects.toThrow("A senha deve conter pelo menos um número.");
    expect(prisma.hotelOwnerSignupRequest.create).not.toHaveBeenCalled();
  });

  it("falha com confirmação diferente", async () => {
    await expect(
      createPendingHotelOwnerSignupRequest({
        ...validPayload,
        confirmPassword: "outrasenha123",
      })
    ).rejects.toThrow("A confirmação de senha não confere.");
    expect(prisma.hotelOwnerSignupRequest.create).not.toHaveBeenCalled();
  });

  it("aceita CNPJ válido sem máscara", async () => {
    await createPendingHotelOwnerSignupRequest({
      ...validPayload,
      hotelDocument: "12345678000195",
    });

    expect(prisma.hotelOwnerSignupRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          hotelDocument: "12345678000195",
        }),
      })
    );
  });

  it("aceita CNPJ válido com máscara", async () => {
    await createPendingHotelOwnerSignupRequest(validPayload);

    expect(prisma.hotelOwnerSignupRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          hotelDocument: "12345678000195",
        }),
      })
    );
  });

  it("falha com CNPJ com menos de 14 dígitos", async () => {
    await expect(
      createPendingHotelOwnerSignupRequest({
        ...validPayload,
        hotelDocument: "12.345.678/0001",
      })
    ).rejects.toThrow("Informe um CNPJ válido no formato 00.000.000/0000-00.");
    expect(prisma.hotelOwnerSignupRequest.create).not.toHaveBeenCalled();
  });

  it("falha com CNPJ de dígitos iguais", async () => {
    await expect(
      createPendingHotelOwnerSignupRequest({
        ...validPayload,
        hotelDocument: "11.111.111/1111-11",
      })
    ).rejects.toThrow("Informe um CNPJ válido no formato 00.000.000/0000-00.");
    expect(prisma.hotelOwnerSignupRequest.create).not.toHaveBeenCalled();
  });

  it("falha com dígito verificador inválido", async () => {
    await expect(
      createPendingHotelOwnerSignupRequest({
        ...validPayload,
        hotelDocument: "12.345.678/0001-90",
      })
    ).rejects.toThrow("Informe um CNPJ válido no formato 00.000.000/0000-00.");
    expect(prisma.hotelOwnerSignupRequest.create).not.toHaveBeenCalled();
  });

  it("salva passwordHash diferente da senha em texto puro", async () => {
    await createPendingHotelOwnerSignupRequest(validPayload);

    expect(hashPassword).toHaveBeenCalledWith("senha123");
    expect(prisma.hotelOwnerSignupRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          passwordHash: "hashed-signup-password",
        }),
      })
    );
    expect("hashed-signup-password").not.toBe(validPayload.password);
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
