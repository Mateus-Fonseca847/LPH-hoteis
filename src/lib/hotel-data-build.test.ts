import { beforeEach, describe, expect, it, vi } from "vitest";

describe("hotel data during Next build", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("nao consulta o banco durante phase-production-build", async () => {
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
});
