import { beforeEach, describe, expect, it, vi } from "vitest";

describe("hotel data during Next build", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("não consulta o banco durante phase-production-build", async () => {
    const queryRaw = vi.fn();
    const findMany = vi.fn();

    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PHASE", "phase-production-build");
    vi.stubEnv("DATABASE_URL", "postgresql://invalid:invalid@127.0.0.1:1/lph_ci");

    vi.doMock("next/cache", () => ({
      unstable_cache: (callback: unknown) => callback,
    }));
    vi.doMock("@/lib/prisma", () => ({
      prisma: {
        $queryRaw: queryRaw,
        hotel: {
          findMany,
        },
      },
    }));

    const { getPublishedHotels } = await import("@/lib/hotel-data");

    await expect(getPublishedHotels()).resolves.toEqual([]);
    expect(queryRaw).not.toHaveBeenCalled();
    expect(findMany).not.toHaveBeenCalled();
  });

  it("deduplica hoteis reais e nao soma fallback quando o banco responde", async () => {
    const queryRaw = vi.fn(async () =>
      ["slug", "name", "city", "state", "coverImageUrl", "isPublished", "phone"].map(
        (column_name) => ({ column_name })
      )
    );
    const findMany = vi.fn(async () => [
      {
        id: "hotel-1",
        slug: "pousada-casa-mare",
        name: "Pousada Casa Mare",
        shortDescription: "Pousada publicada",
        city: "Paraty",
        state: "RJ",
        coverImageUrl: "/casa-mare.webp",
      },
      {
        id: "hotel-2",
        slug: "pousada-casa-mare",
        name: "Pousada Casa Mare duplicada",
        shortDescription: "Duplicada",
        city: "Paraty",
        state: "RJ",
        coverImageUrl: "/casa-mare-2.webp",
      },
    ]);

    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATABASE_URL", "postgresql://valid.example/lph");
    vi.stubEnv("NEXT_PHASE", "");

    vi.doMock("next/cache", () => ({
      unstable_cache: (callback: unknown) => callback,
    }));
    vi.doMock("@/lib/hotel-archive", () => ({
      getPublicHotelWhere: vi.fn(async () => ({ isPublished: true })),
    }));
    vi.doMock("@/lib/prisma", () => ({
      prisma: {
        $queryRaw: queryRaw,
        hotel: {
          findMany,
        },
      },
    }));

    const { getPublishedHotels } = await import("@/lib/hotel-data");

    await expect(getPublishedHotels()).resolves.toEqual([
      expect.objectContaining({
        id: "hotel-1",
        slug: "pousada-casa-mare",
      }),
    ]);
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          coverImageUrl: true,
          images: expect.any(Object),
          rooms: expect.any(Object),
        }),
      })
    );
  });
});
