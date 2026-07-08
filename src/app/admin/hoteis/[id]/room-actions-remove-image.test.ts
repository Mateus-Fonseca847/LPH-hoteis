import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthorizationError } from "@/lib/errors/app-error";
import { requireAuthorizedHotelWrite } from "@/lib/hotel-write";
import { prisma } from "@/lib/prisma";
import { deleteStoredHotelImageFile } from "@/lib/uploads/hotel-images";

import { removeHotelRoomImageAction } from "./room-actions";

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
  deleteStoredHotelImageFile: vi.fn(async () => ({ status: "removed" })),
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
const imageId1 = "image_000001";
const imageId2 = "image_000002";
const imageId3 = "image_000003";

const room = {
  id: roomId,
  name: "Suíte",
  description: "Quarto confortável",
  imageUrl: "https://cdn.example.test/image-1.webp",
  units: 1,
  capacityAdults: 2,
  capacityChildren: 0,
  beds: "1x cama queen",
  sizeM2: 30,
  amenities: ["Wi-Fi"],
  isActive: true,
  capacity: 2,
  size: "30 m²",
  priceFrom: { toString: () => "0" },
  isAvailable: true,
};

function buildTx(images: Array<{ id: string; url: string; alt: string; position: number }>) {
  const currentImages = [...images];

  return {
    hotelRoomImage: {
      findMany: vi.fn(async () => currentImages),
      delete: vi.fn(async ({ where }: { where: { id: string } }) => {
        const index = currentImages.findIndex((image) => image.id === where.id);

        if (index >= 0) {
          currentImages.splice(index, 1);
        }

        return { id: where.id };
      }),
      update: vi.fn(
        async ({ where, data }: { where: { id: string }; data: { position: number } }) => {
          const image = currentImages.find((item) => item.id === where.id);

          if (image) {
            image.position = data.position;
          }

          return image;
        }
      ),
    },
    hotelRoom: {
      update: vi.fn(async ({ data }: { data: { imageUrl: string } }) => ({
        ...room,
        imageUrl: data.imageUrl,
      })),
    },
  };
}

describe("removeHotelRoomImageAction", () => {
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
    vi.mocked(prisma.hotelRoom.findFirst).mockReset().mockResolvedValue(room);
    vi.mocked(prisma.$transaction).mockReset();
    vi.mocked(deleteStoredHotelImageFile).mockClear();
  });

  it("remove imagem específica sem alterar a capa quando remove imagem secundária", async () => {
    const tx = buildTx([
      { id: imageId1, url: "https://cdn.example.test/image-1.webp", alt: "Imagem 1", position: 0 },
      { id: imageId2, url: "https://cdn.example.test/image-2.webp", alt: "Imagem 2", position: 1 },
      { id: imageId3, url: "https://cdn.example.test/image-3.webp", alt: "Imagem 3", position: 2 },
    ]);
    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => callback(tx));

    await expect(removeHotelRoomImageAction(hotelId, roomId, imageId2)).resolves.toEqual({
      status: "success",
      message: "Imagem removida com sucesso.",
      roomId,
    });

    expect(tx.hotelRoomImage.delete).toHaveBeenCalledWith({ where: { id: imageId2 } });
    expect(tx.hotelRoom.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          imageUrl: "https://cdn.example.test/image-1.webp",
        },
      })
    );
  });

  it("promove a próxima imagem quando remove a capa", async () => {
    const tx = buildTx([
      { id: imageId1, url: "https://cdn.example.test/image-1.webp", alt: "Imagem 1", position: 0 },
      { id: imageId2, url: "https://cdn.example.test/image-2.webp", alt: "Imagem 2", position: 1 },
    ]);
    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => callback(tx));

    await removeHotelRoomImageAction(hotelId, roomId, imageId1);

    expect(tx.hotelRoom.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          imageUrl: "https://cdn.example.test/image-2.webp",
        },
      })
    );
  });

  it("remove a última imagem e mantém o quarto editável com imageUrl vazio", async () => {
    const tx = buildTx([
      { id: imageId1, url: "https://cdn.example.test/image-1.webp", alt: "Imagem 1", position: 0 },
    ]);
    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => callback(tx));

    await removeHotelRoomImageAction(hotelId, roomId, imageId1);

    expect(tx.hotelRoom.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          imageUrl: "",
        },
      })
    );
  });

  it("retorna erro específico para imagem inexistente", async () => {
    const tx = buildTx([
      { id: imageId1, url: "https://cdn.example.test/image-1.webp", alt: "Imagem 1", position: 0 },
    ]);
    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => callback(tx));

    await expect(removeHotelRoomImageAction(hotelId, roomId, "image_404404")).resolves.toEqual({
      status: "error",
      message: "Imagem não encontrada.",
    });
  });

  it("bloqueia remoção sem permissão", async () => {
    vi.mocked(requireAuthorizedHotelWrite).mockRejectedValue(
      new AuthorizationError("Você não tem permissão para remover esta imagem.")
    );

    await expect(removeHotelRoomImageAction(hotelId, roomId, imageId1)).resolves.toEqual({
      status: "error",
      message: "Você não tem permissão para remover esta imagem.",
    });
  });

  it("permite super_admin remover imagem", async () => {
    vi.mocked(requireAuthorizedHotelWrite).mockResolvedValue({
      id: "super_123456",
      name: "Super",
      email: "super@example.com",
      globalRole: "super_admin",
      isActive: true,
    });
    const tx = buildTx([
      { id: imageId1, url: "https://cdn.example.test/image-1.webp", alt: "Imagem 1", position: 0 },
    ]);
    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => callback(tx));

    await expect(removeHotelRoomImageAction(hotelId, roomId, imageId1)).resolves.toEqual({
      status: "success",
      message: "Imagem removida com sucesso.",
      roomId,
    });
  });
});
