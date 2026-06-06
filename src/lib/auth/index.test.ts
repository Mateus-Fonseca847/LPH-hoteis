import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdminAccessError, isAdminUser, requireAdminRouteSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("redirect");
  }),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthSession: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

describe("admin auth helpers", () => {
  beforeEach(async () => {
    const { getAuthSession } = await import("@/lib/auth/session");

    vi.mocked(getAuthSession).mockReset();
    vi.mocked(prisma.user.findUnique).mockReset();
  });

  it("mantém Sair separado da lógica admin ao identificar usuário comum", () => {
    expect(isAdminUser("user")).toBe(false);
  });

  it("identifica hotel_admin como admin", () => {
    expect(isAdminUser("hotel_admin")).toBe(true);
  });

  it("identifica super_admin como admin", () => {
    expect(isAdminUser("super_admin")).toBe(true);
  });

  it("bloqueia rota admin para usuário comum", async () => {
    const { getAuthSession } = await import("@/lib/auth/session");

    vi.mocked(getAuthSession).mockResolvedValue({
      sub: "user-1",
      globalRole: "user",
      twoFactorVerified: false,
      twoFactorSetupRequired: false,
    });
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      name: "Usuário comum",
      email: "user@example.com",
      globalRole: "user",
      isActive: true,
      emailTwoFactorEnabled: false,
      twoFactorEnabled: false,
    });

    await expect(requireAdminRouteSession("/admin")).rejects.toBeInstanceOf(AdminAccessError);
  });
});
