import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HotelRole } from "@prisma/client";

import { requireAuthenticatedRequestUser } from "@/lib/auth";
import { canEditHotel } from "@/lib/auth/authorization";
import { prisma } from "@/lib/prisma";
import { searchPublishedHotels } from "@/lib/hotel-search";
import { getPublishedMapHotels } from "@/lib/hotel-map";
import { storeHotelImageFile } from "@/lib/uploads/hotel-images";

import { createHotelAction } from "./actions";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  unstable_cache: (fn: unknown) => fn,
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers({ "x-real-ip": "127.0.0.1" })),
}));

vi.mock("@/lib/auth", () => ({
  requireAuthenticatedRequestUser: vi.fn(),
}));

vi.mock("@/lib/uploads/hotel-images", () => ({
  storeHotelImageFile: vi.fn(),
}));

vi.mock("@/lib/hotel-amenities", () => ({
  getCanonicalAmenityLabel: (label: string) => label,
}));

type TestHotel = {
  id: string;
  name: string;
  slug: string;
  shortDescription: string;
  fullDescription: string;
  city: string;
  state: string;
  address: string;
  phone: string;
  email: string;
  whatsapp: string;
  coverImageUrl: string;
  checkInTime: string;
  checkOutTime: string;
  latitude: unknown;
  longitude: unknown;
  isPublished: boolean;
  images: { id: string; url: string; alt: string; position: number }[];
  amenities: { id: string; label: string; position: number }[];
  policies: { id: string; title: string; description: string; position: number }[];
  rooms: Array<{ rates: { id: string }[]; availability: { id: string }[] }>;
};

type TestPermission = {
  userId: string;
  hotelId: string;
  role: HotelRole;
};

type CreateHotelData = {
  id: string;
  name: string;
  slug: string;
  shortDescription: string;
  fullDescription: string;
  city: string;
  state: string;
  address: string;
  phone: string;
  email: string;
  whatsapp: string;
  coverImageUrl: string;
  checkInTime: string;
  checkOutTime: string;
  latitude?: unknown;
  longitude?: unknown;
  isPublished: boolean;
  images: {
    create: { url: string; alt: string; position: number }[];
  };
  amenities?: {
    create: { label: string; position: number }[];
  };
  policies?: {
    create: { title: string; description: string; position: number }[];
  };
};

type PermissionUpsertArgs = {
  where: {
    userId_hotelId: {
      userId: string;
      hotelId: string;
    };
  };
  update: {
    role: HotelRole;
  };
  create: TestPermission;
};

const db: {
  hotels: TestHotel[];
  permissions: TestPermission[];
  auditLogs: unknown[];
} = {
  hotels: [],
  permissions: [],
  auditLogs: [],
};

function selectHotel(hotel: TestHotel, select?: Record<string, unknown>) {
  if (!select) {
    return hotel;
  }

  return Object.fromEntries(
    Object.entries(select).map(([key]) => [key, hotel[key as keyof TestHotel]])
  );
}

function findHotels(args: { where?: { slug?: string; isPublished?: boolean }; select?: object }) {
  return db.hotels
    .filter((hotel) => (args.where?.slug ? hotel.slug === args.where.slug : true))
    .filter((hotel) =>
      typeof args.where?.isPublished === "boolean"
        ? hotel.isPublished === args.where.isPublished
        : true
    )
    .map((hotel) => selectHotel(hotel, args.select as Record<string, unknown> | undefined));
}

const tx = {
  hotel: {
    create: vi.fn(async ({ data }: { data: CreateHotelData }) => {
      const hotel: TestHotel = {
        id: String(data.id),
        name: String(data.name),
        slug: String(data.slug),
        shortDescription: String(data.shortDescription),
        fullDescription: String(data.fullDescription),
        city: String(data.city),
        state: String(data.state),
        address: String(data.address),
        phone: String(data.phone),
        email: String(data.email),
        whatsapp: String(data.whatsapp),
        coverImageUrl: String(data.coverImageUrl),
        checkInTime: String(data.checkInTime),
        checkOutTime: String(data.checkOutTime),
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
        isPublished: Boolean(data.isPublished),
        images: data.images.create.map(
          (image: { url: string; alt: string; position: number }, index: number) => ({
            id: `image-${index + 1}`,
            ...image,
          })
        ),
        amenities: (data.amenities?.create ?? []).map(
          (amenity: { label: string; position: number }, index: number) => ({
            id: `amenity-${index + 1}`,
            ...amenity,
          })
        ),
        policies: (data.policies?.create ?? []).map(
          (policy: { title: string; description: string; position: number }, index: number) => ({
            id: `policy-${index + 1}`,
            ...policy,
          })
        ),
        rooms: [],
      };

      db.hotels.push(hotel);

      return { id: hotel.id };
    }),
  },
  hotelPermission: {
    upsert: vi.fn(async ({ create, update, where }: PermissionUpsertArgs) => {
      const existing = db.permissions.find(
        (permission) =>
          permission.userId === where.userId_hotelId.userId &&
          permission.hotelId === where.userId_hotelId.hotelId
      );

      if (existing) {
        existing.role = update.role;
        return existing;
      }

      db.permissions.push(create);
      return create;
    }),
  },
  hotelAuditLog: {
    create: vi.fn(async ({ data }: { data: unknown }) => {
      db.auditLogs.push(data);
      return data;
    }),
  },
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    hotel: {
      findUnique: vi.fn(async (args) => findHotels(args)[0] ?? null),
      findMany: vi.fn(async (args = {}) => findHotels(args)),
    },
    user: {
      findUnique: vi.fn(async (args) => {
        const permission = db.permissions.find(
          (item) =>
            item.userId === args.where.id &&
            item.hotelId === args.select.hotelPermissions.where.hotelId
        );

        return {
          globalRole: "hotel_admin",
          isActive: true,
          hotelPermissions: permission ? [{ role: permission.role }] : [],
        };
      }),
    },
    hotelPermission: {
      findMany: vi.fn(async (args) =>
        db.permissions
          .filter((permission) => permission.userId === args.where.userId)
          .filter((permission) => args.where.role.in.includes(permission.role))
          .map((permission) => ({
            role: permission.role,
            hotel: selectHotel(
              db.hotels.find((hotel) => hotel.id === permission.hotelId)!,
              args.select.hotel.select
            ),
          }))
      ),
    },
    $queryRaw: vi.fn(async () => [
      {
        slug: "ok",
        name: "ok",
        city: "ok",
        state: "ok",
        coverImageUrl: "ok",
        isPublished: true,
        phone: "ok",
      },
    ]),
    $transaction: vi.fn(async (input) => (Array.isArray(input) ? Promise.all(input) : input(tx))),
  },
}));

function buildFormData() {
  const formData = new FormData();

  formData.set("name", "LPH Fluxo Teste");
  formData.set("city", "São Paulo");
  formData.set("state", "SP");
  formData.set("shortDescription", "Hotel de teste do fluxo.");
  formData.set(
    "fullDescription",
    "Hotel criado pelo teste automatizado de fluxo para validar rascunho inicial."
  );
  formData.set("address", "Rua do Fluxo, 100 - São Paulo - SP");
  formData.set("phone", "(11) 3000-0000");
  formData.set("email", "fluxo@example.com");
  formData.set("whatsapp", "(11) 99999-0000");
  formData.set("checkInTime", "14:00");
  formData.set("checkOutTime", "12:00");
  formData.set("coverImage", new File(["fake image"], "capa.webp", { type: "image/webp" }));
  formData.set("coverAlt", "Fachada do hotel de teste");

  return formData;
}

describe("fluxo de criação de hotel", () => {
  beforeEach(() => {
    db.hotels = [];
    db.permissions = [];
    db.auditLogs = [];
    vi.mocked(requireAuthenticatedRequestUser).mockReset();
    vi.mocked(storeHotelImageFile).mockReset().mockResolvedValue({
      url: "https://cdn.example.test/hotels/lph-fluxo-teste/capa.webp",
      storageKey: "hotels/lph-fluxo-teste/capa.webp",
      contentType: "image/webp",
      size: 1024,
    });
    vi.mocked(prisma.hotel.findUnique).mockClear();
    vi.mocked(prisma.hotel.findMany).mockClear();
    vi.mocked(prisma.user.findUnique).mockClear();
    vi.mocked(prisma.hotelPermission.findMany).mockClear();
    vi.mocked(prisma.$transaction).mockClear();
    tx.hotel.create.mockClear();
    tx.hotelPermission.upsert.mockClear();
    tx.hotelAuditLog.create.mockClear();
  });

  it("cria rascunho real no banco de teste, aparece no admin e não aparece publicamente", async () => {
    vi.mocked(requireAuthenticatedRequestUser).mockResolvedValue({
      id: "admin-1",
      name: "Admin Hotel",
      email: "admin@example.com",
      globalRole: "hotel_admin",
      isActive: true,
    });

    const result = await createHotelAction({ status: "idle", message: "" }, buildFormData());

    expect(result).toMatchObject({
      status: "success",
      message: "Hotel salvo como rascunho.",
      hotelId: expect.any(String),
    });

    const createdHotel = db.hotels.find((hotel) => hotel.id === result.hotelId);
    expect(createdHotel).toMatchObject({
      name: "LPH Fluxo Teste",
      slug: "lph-fluxo-teste",
      isPublished: false,
      rooms: [],
    });
    expect(db.permissions).toContainEqual({
      userId: "admin-1",
      hotelId: result.hotelId,
      role: HotelRole.owner,
    });
    await expect(canEditHotel("admin-1", String(result.hotelId))).resolves.toBe(true);
    await expect(canEditHotel("admin-1", "hotel-terceiro")).resolves.toBe(false);

    const adminHotels = await prisma.hotelPermission.findMany({
      where: {
        userId: "admin-1",
        role: {
          in: [HotelRole.owner, HotelRole.admin, HotelRole.editor],
        },
      },
      select: {
        role: true,
        hotel: {
          select: {
            id: true,
            name: true,
            isPublished: true,
          },
        },
      },
    });

    expect(adminHotels).toEqual([
      {
        role: HotelRole.owner,
        hotel: {
          id: result.hotelId,
          name: "LPH Fluxo Teste",
          isPublished: false,
        },
      },
    ]);

    await expect(searchPublishedHotels("Fluxo")).resolves.toEqual([]);
    await expect(getPublishedMapHotels()).resolves.toEqual([]);

    expect(prisma.hotel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isPublished: true,
        }),
      })
    );
  });

  it("hotel publicado aparece nas consultas públicas", async () => {
    db.hotels.push({
      id: "hotel-publicado",
      name: "LPH Publicado",
      slug: "lph-publicado",
      shortDescription: "Hotel publicado para teste.",
      fullDescription: "Hotel publicado para teste público.",
      city: "São Paulo",
      state: "SP",
      address: "Rua Pública, 10",
      phone: "(11) 3000-0000",
      email: "publico@example.com",
      whatsapp: "(11) 99999-0000",
      coverImageUrl: "https://cdn.example.test/publicado.webp",
      checkInTime: "14:00",
      checkOutTime: "12:00",
      latitude: null,
      longitude: null,
      isPublished: true,
      images: [],
      amenities: [],
      policies: [],
      rooms: [],
    });

    await expect(searchPublishedHotels("Publicado")).resolves.toEqual([
      expect.objectContaining({
        slug: "lph-publicado",
      }),
    ]);
    await expect(getPublishedMapHotels()).resolves.toEqual([
      expect.objectContaining({
        slug: "lph-publicado",
      }),
    ]);
  });

  it("permite super_admin criar rascunho e bloqueia usuário comum", async () => {
    vi.mocked(requireAuthenticatedRequestUser).mockResolvedValueOnce({
      id: "super-1",
      name: "Super Admin",
      email: "super@example.com",
      globalRole: "super_admin",
      isActive: true,
    });

    await expect(
      createHotelAction({ status: "idle", message: "" }, buildFormData())
    ).resolves.toMatchObject({
      status: "success",
      hotelId: expect.any(String),
    });

    vi.mocked(requireAuthenticatedRequestUser).mockResolvedValueOnce({
      id: "user-1",
      name: "Usuário",
      email: "user@example.com",
      globalRole: "user",
      isActive: true,
    });

    await expect(
      createHotelAction({ status: "idle", message: "" }, buildFormData())
    ).resolves.toEqual({
      status: "error",
      message: "Você não tem permissão para criar hotéis.",
      errorCode: "FORBIDDEN",
    });
  });

  it("mantém redirecionamento e seções dependentes liberadas depois do primeiro save", () => {
    const createFormSource = readFileSync(
      new URL("./novo/CreateHotelForm.tsx", import.meta.url),
      "utf8"
    );
    const editPageSource = readFileSync(new URL("./[id]/page.tsx", import.meta.url), "utf8");

    expect(createFormSource).toContain("router.push(`/admin/hoteis/${state.hotelId}`)");
    expect(editPageSource).toContain("HotelRoomsSection");
    expect(editPageSource).not.toContain("HotelRatesSection");
    expect(editPageSource).not.toContain("ratesSlot={");
    expect(editPageSource).toContain("HotelAvailabilitySection");
    expect(editPageSource).toContain("HotelEditorForm");
    expect(editPageSource).toContain("experiences");
    expect(editPageSource).toContain("upload");
  });
});
