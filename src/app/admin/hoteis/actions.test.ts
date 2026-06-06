import { beforeEach, describe, expect, it, vi } from "vitest";

import { Prisma } from "@prisma/client";

import { requireAuthenticatedRequestUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { storeHotelImageFile } from "@/lib/uploads/hotel-images";

import { createHotelAction } from "./actions";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers({ "x-real-ip": "127.0.0.1" })),
}));

vi.mock("@/lib/auth", () => ({
  requireAuthenticatedRequestUser: vi.fn(),
}));

vi.mock("@/lib/hotel-amenities", () => ({
  getCanonicalAmenityLabel: (label: string) => label,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    hotel: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/uploads/hotel-images", () => ({
  storeHotelImageFile: vi.fn(),
}));

function buildFormData(
  overrides: Record<string, string> = {},
  options?: {
    amenities?: string[];
    policies?: Array<{ title: string; description: string }>;
    coverImage?: File | null;
  }
) {
  const formData = new FormData();
  const values = {
    name: "LPH Centro",
    slug: "lph-centro",
    city: "São Paulo",
    state: "SP",
    shortDescription: "Hotel urbano para operação inicial.",
    fullDescription:
      "Hotel urbano com localização central, operação prática e estrutura para lazer e negócios.",
    address: "Rua Central, 100 - Centro, São Paulo - SP",
    phone: "(11) 3000-0000",
    email: "reservas@lphcentro.com.br",
    whatsapp: "(11) 99999-0000",
    checkInTime: "14:00",
    checkOutTime: "12:00",
    ...overrides,
  };

  Object.entries(values).forEach(([key, value]) => {
    formData.set(key, value);
  });
  (options?.amenities ?? ["Piscina", "Wi-Fi", "Café da manhã"]).forEach((amenity) => {
    formData.append("amenities", amenity);
  });
  (
    options?.policies ?? [
      {
        title: "Cancelamento",
        description: "Cancelamento gratuito até 72 horas antes da chegada.",
      },
    ]
  ).forEach((policy) => {
    formData.append("policies", JSON.stringify(policy));
  });
  if (options?.coverImage !== null) {
    formData.set(
      "coverImage",
      options?.coverImage ?? new File(["fake image"], "capa.webp", { type: "image/webp" })
    );
  }
  formData.set("coverAlt", "Fachada do hotel");

  return formData;
}

describe("createHotelAction", () => {
  beforeEach(() => {
    vi.mocked(requireAuthenticatedRequestUser).mockReset();
    vi.mocked(prisma.hotel.findUnique).mockReset();
    vi.mocked(prisma.$transaction).mockReset();
    vi.mocked(storeHotelImageFile).mockReset().mockResolvedValue({
      url: "https://cdn.example.test/hotels/hotel-1/capa.webp",
      storageKey: "hotels/hotel-1/capa.webp",
      contentType: "image/webp",
      size: 1024,
    });
  });

  it("bloqueia criação por usuário não administrativo", async () => {
    vi.mocked(requireAuthenticatedRequestUser).mockResolvedValue({
      id: "user-1",
      name: "Usuário",
      email: "user@example.com",
      globalRole: "user",
      isActive: true,
    });

    const result = await createHotelAction({ status: "idle", message: "" }, buildFormData());

    expect(result).toEqual({
      status: "error",
      message: "Você não tem permissão para criar hotéis.",
    });
    expect(prisma.hotel.findUnique).not.toHaveBeenCalled();
  });

  it("cria hotel, vínculo owner e auditoria para hotel_admin", async () => {
    const tx = {
      hotel: {
        create: vi.fn(async () => ({ id: "hotel-1" })),
      },
      hotelPermission: {
        upsert: vi.fn(),
      },
      hotelAuditLog: {
        create: vi.fn(),
      },
    };

    vi.mocked(requireAuthenticatedRequestUser).mockResolvedValue({
      id: "admin-1",
      name: "Admin Hotel",
      email: "admin@example.com",
      globalRole: "hotel_admin",
      isActive: true,
    });
    vi.mocked(prisma.hotel.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => callback(tx));

    const formData = buildFormData();
    formData.set("isPublished", "on");

    const result = await createHotelAction({ status: "idle", message: "" }, formData);

    expect(result).toMatchObject({
      status: "success",
      hotelId: "hotel-1",
    });
    expect(tx.hotel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "LPH Centro",
          slug: "lph-centro",
          city: "São Paulo",
          state: "SP",
          fullDescription:
            "Hotel urbano com localização central, operação prática e estrutura para lazer e negócios.",
          address: "Rua Central, 100 - Centro, São Paulo - SP",
          latitude: expect.anything(),
          longitude: expect.anything(),
          phone: "(11) 3000-0000",
          email: "reservas@lphcentro.com.br",
          whatsapp: "(11) 99999-0000",
          coverImageUrl: "https://cdn.example.test/hotels/hotel-1/capa.webp",
          checkInTime: "14:00",
          checkOutTime: "12:00",
          isPublished: false,
          images: {
            create: [
              {
                url: "https://cdn.example.test/hotels/hotel-1/capa.webp",
                alt: "Fachada do hotel",
                position: 0,
              },
            ],
          },
          amenities: {
            create: [
              { label: "Piscina", position: 0 },
              { label: "Wi-Fi", position: 1 },
              { label: "Café da manhã", position: 2 },
            ],
          },
          policies: {
            create: [
              {
                title: "Cancelamento",
                description: "Cancelamento gratuito até 72 horas antes da chegada.",
                position: 0,
              },
            ],
          },
        }),
      })
    );
    expect(storeHotelImageFile).toHaveBeenCalledWith(expect.any(String), expect.any(File));
    expect(tx.hotelPermission.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          userId: "admin-1",
          hotelId: "hotel-1",
          role: "owner",
        }),
      })
    );
    expect(tx.hotelAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "hotel.profile.created",
          hotelId: "hotel-1",
          userId: "admin-1",
        }),
      })
    );
  });

  it("falha com slug duplicado", async () => {
    vi.mocked(requireAuthenticatedRequestUser).mockResolvedValue({
      id: "super-1",
      name: "Super Admin",
      email: "super@example.com",
      globalRole: "super_admin",
      isActive: true,
    });
    vi.mocked(prisma.hotel.findUnique).mockResolvedValue({ id: "hotel-existente" });

    const result = await createHotelAction({ status: "idle", message: "" }, buildFormData());

    expect(result).toEqual({
      status: "error",
      message: "Já existe um hotel com este slug.",
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("aceita comodidades e políticas no formato estruturado da tela de criação", async () => {
    const tx = {
      hotel: {
        create: vi.fn(async () => ({ id: "hotel-2" })),
      },
      hotelPermission: {
        upsert: vi.fn(),
      },
      hotelAuditLog: {
        create: vi.fn(),
      },
    };

    vi.mocked(requireAuthenticatedRequestUser).mockResolvedValue({
      id: "admin-2",
      name: "Admin Hotel",
      email: "admin2@example.com",
      globalRole: "hotel_admin",
      isActive: true,
    });
    vi.mocked(prisma.hotel.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => callback(tx));

    const result = await createHotelAction(
      { status: "idle", message: "" },
      buildFormData(
        {},
        {
          amenities: ["Piscina", "Wi-Fi"],
          policies: [
            {
              title: "Check-in",
              description: "Entrada disponível a partir das 14h.",
            },
            {
              title: "Pets",
              description: "Pets são aceitos sob consulta.",
            },
          ],
        }
      )
    );

    expect(result).toMatchObject({
      status: "success",
      hotelId: "hotel-2",
    });
    expect(tx.hotel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amenities: {
            create: [
              { label: "Piscina", position: 0 },
              { label: "Wi-Fi", position: 1 },
            ],
          },
          policies: {
            create: [
              {
                title: "Check-in",
                description: "Entrada disponível a partir das 14h.",
                position: 0,
              },
              {
                title: "Pets",
                description: "Pets são aceitos sob consulta.",
                position: 1,
              },
            ],
          },
        }),
      })
    );
  });
  it("não cria hotel sem e-mail de contato", async () => {
    vi.mocked(requireAuthenticatedRequestUser).mockResolvedValue({
      id: "admin-1",
      name: "Admin Hotel",
      email: "admin@example.com",
      globalRole: "hotel_admin",
      isActive: true,
    });

    const result = await createHotelAction(
      { status: "idle", message: "" },
      buildFormData({ email: "" })
    );

    expect(result).toEqual({
      status: "error",
      message: "Informe o e-mail de contato do hotel.",
    });
    expect(prisma.hotel.findUnique).not.toHaveBeenCalled();
  });

  it("não cria hotel com e-mail inválido", async () => {
    vi.mocked(requireAuthenticatedRequestUser).mockResolvedValue({
      id: "admin-1",
      name: "Admin Hotel",
      email: "admin@example.com",
      globalRole: "hotel_admin",
      isActive: true,
    });

    const result = await createHotelAction(
      { status: "idle", message: "" },
      buildFormData({ email: "inválido" })
    );

    expect(result).toEqual({
      status: "error",
      message: "Informe um e-mail de contato valido.",
    });
    expect(prisma.hotel.findUnique).not.toHaveBeenCalled();
  });

  it("não cria hotel sem imagem de capa", async () => {
    vi.mocked(requireAuthenticatedRequestUser).mockResolvedValue({
      id: "admin-1",
      name: "Admin Hotel",
      email: "admin@example.com",
      globalRole: "hotel_admin",
      isActive: true,
    });

    const result = await createHotelAction(
      { status: "idle", message: "" },
      buildFormData({}, { coverImage: null })
    );

    expect(result).toEqual({
      status: "error",
      message: "Envie uma imagem de capa.",
    });
    expect(storeHotelImageFile).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("mostra erro específico e registra falha de upload/storage", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    vi.mocked(requireAuthenticatedRequestUser).mockResolvedValue({
      id: "admin-1",
      name: "Admin Hotel",
      email: "admin@example.com",
      globalRole: "hotel_admin",
      isActive: true,
    });
    vi.mocked(prisma.hotel.findUnique).mockResolvedValue(null);
    vi.mocked(storeHotelImageFile).mockRejectedValue(new Error("S3_ACCESS_KEY_ID missing"));

    const result = await createHotelAction({ status: "idle", message: "" }, buildFormData());

    expect(result).toEqual({
      status: "error",
      message: "Falha ao enviar imagem. Verifique o storage.",
    });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[admin/hoteis/create] Failed to create hotel.",
      expect.objectContaining({
        step: "cover-upload",
        cause: expect.objectContaining({
          message: "S3_ACCESS_KEY_ID missing",
        }),
      })
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it("converte erro Prisma de slug duplicado em mensagem específica", async () => {
    vi.mocked(requireAuthenticatedRequestUser).mockResolvedValue({
      id: "admin-1",
      name: "Admin Hotel",
      email: "admin@example.com",
      globalRole: "hotel_admin",
      isActive: true,
    });
    vi.mocked(prisma.hotel.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.$transaction).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
        meta: { target: ["slug"] },
      })
    );

    const result = await createHotelAction({ status: "idle", message: "" }, buildFormData());

    expect(result).toEqual({
      status: "error",
      message: "Já existe um hotel com este slug.",
    });
  });

  it("mostra erro específico para falha ao criar relações do hotel", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    vi.mocked(requireAuthenticatedRequestUser).mockResolvedValue({
      id: "admin-1",
      name: "Admin Hotel",
      email: "admin@example.com",
      globalRole: "hotel_admin",
      isActive: true,
    });
    vi.mocked(prisma.hotel.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.$transaction).mockRejectedValue(new Error("HotelPolicy table missing"));

    const result = await createHotelAction({ status: "idle", message: "" }, buildFormData());

    expect(result).toEqual({
      status: "error",
      message: "Falha ao salvar hotel, galeria, comodidades ou políticas.",
    });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[admin/hoteis/create] Failed to create hotel.",
      expect.objectContaining({
        step: "database-transaction",
        cause: expect.objectContaining({
          message: "HotelPolicy table missing",
        }),
      })
    );

    consoleErrorSpy.mockRestore();
  });
});
