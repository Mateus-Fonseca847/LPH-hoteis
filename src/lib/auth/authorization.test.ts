import { HotelRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  canEditHotel,
  canViewHotelAdmin,
  requireHotelAdminAccess,
  requireHotelEditAccess,
} from "@/lib/auth/authorization";
import { AuthorizationError } from "@/lib/errors/app-error";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

const findUser = vi.mocked(prisma.user.findUnique);

function mockUser({
  globalRole,
  isActive = true,
  hotelRole = null,
}: {
  globalRole: "super_admin" | "hotel_admin" | "user";
  isActive?: boolean;
  hotelRole?: HotelRole | null;
}) {
  findUser.mockResolvedValue({
    globalRole,
    isActive,
    hotelPermissions: hotelRole ? [{ role: hotelRole }] : [],
  });
}

describe("admin authorization scope", () => {
  beforeEach(() => {
    findUser.mockReset();
  });

  it("permite super_admin em qualquer hotel", async () => {
    mockUser({ globalRole: "super_admin" });

    await expect(requireHotelAdminAccess("user-1", "hotel-a")).resolves.toEqual({
      globalRole: "super_admin",
      hotelRole: null,
    });
    await expect(canViewHotelAdmin("user-1", "hotel-b")).resolves.toBe(true);
  });

  it("permite hotel_admin apenas no hotel vinculado", async () => {
    mockUser({ globalRole: "hotel_admin", hotelRole: HotelRole.admin });

    await expect(canViewHotelAdmin("user-1", "hotel-a")).resolves.toBe(true);
    await expect(canEditHotel("user-1", "hotel-a")).resolves.toBe(true);
  });

  it("permite owner vinculado nas operacoes administrativas do hotel", async () => {
    mockUser({ globalRole: "hotel_admin", hotelRole: HotelRole.owner });

    await expect(requireHotelAdminAccess("user-1", "hotel-a")).resolves.toEqual({
      globalRole: "hotel_admin",
      hotelRole: HotelRole.owner,
    });
    await expect(requireHotelEditAccess("user-1", "hotel-a")).resolves.toEqual({
      globalRole: "hotel_admin",
      hotelRole: HotelRole.owner,
    });
  });

  it("bloqueia hotel_admin sem permissao no hotel", async () => {
    mockUser({ globalRole: "hotel_admin" });

    await expect(canViewHotelAdmin("user-1", "hotel-a")).resolves.toBe(false);
    await expect(requireHotelEditAccess("user-1", "hotel-a")).rejects.toBeInstanceOf(
      AuthorizationError
    );
  });

  it("bloqueia editor em operacoes administrativas criticas do hotel", async () => {
    mockUser({ globalRole: "hotel_admin", hotelRole: HotelRole.editor });

    await expect(canEditHotel("user-1", "hotel-a")).resolves.toBe(true);
    await expect(requireHotelAdminAccess("user-1", "hotel-a")).rejects.toBeInstanceOf(
      AuthorizationError
    );
  });

  it("bloqueia usuario comum e usuario inativo", async () => {
    mockUser({ globalRole: "user" });
    await expect(canViewHotelAdmin("user-1", "hotel-a")).resolves.toBe(false);

    mockUser({ globalRole: "super_admin", isActive: false });
    await expect(canEditHotel("user-1", "hotel-a")).resolves.toBe(false);
  });
});
