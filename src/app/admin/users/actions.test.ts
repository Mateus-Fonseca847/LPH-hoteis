import { prisma } from "@/lib/prisma";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  addUserHotelPermissionAction,
  listAccessibleAdministratorsAction,
  removeUserHotelPermissionAction,
} from "./actions";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers({ "x-real-ip": "127.0.0.1" })),
}));

vi.mock("@/lib/auth", () => ({
  requireAuthenticatedRequestUser: vi.fn(),
  isAdminUser: vi.fn((role: string) => role === "hotel_admin" || role === "super_admin"),
}));

vi.mock("@/lib/auth/admin-security", () => ({
  validateAdminTwoFactor: vi.fn(async () => ({ success: true, message: "" })),
}));

vi.mock("@/lib/auth/admin-permissions", () => ({
  assertCanManageAdministrativeTarget: vi.fn(),
}));

vi.mock("@/lib/audit/admin-user-audit", () => ({
  createAdminUserAuditLog: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    hotel: {
      findUnique: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    hotelPermission: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { requireAuthenticatedRequestUser } from "@/lib/auth";
import { createAdminUserAuditLog } from "@/lib/audit/admin-user-audit";

describe("admin user access actions", () => {
  beforeEach(() => {
    vi.mocked(requireAuthenticatedRequestUser).mockReset();
    vi.mocked(prisma.hotel.findUnique).mockReset();
    vi.mocked(prisma.user.findMany).mockReset();
    vi.mocked(prisma.user.findUnique).mockReset();
    vi.mocked(prisma.hotelPermission.findFirst).mockReset();
    vi.mocked(prisma.hotelPermission.findUnique).mockReset();
    vi.mocked(prisma.$transaction).mockReset();
    vi.mocked(createAdminUserAuditLog).mockReset();
  });

  it("bloqueia hotel_admin ao listar gestão de acessos", async () => {
    vi.mocked(requireAuthenticatedRequestUser).mockResolvedValue({
      id: "hotel-admin-001",
      globalRole: "hotel_admin",
      isActive: true,
    } as never);

    const result = await listAccessibleAdministratorsAction();

    expect(result.status).toBe("error");
    expect(result.message).toContain("super administrador");
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it("super_admin concede hotel adicional para hotel_admin e registra auditoria", async () => {
    vi.mocked(requireAuthenticatedRequestUser).mockResolvedValue({
      id: "super-admin-001",
      globalRole: "super_admin",
      isActive: true,
    } as never);
    vi.mocked(prisma.hotel.findUnique).mockResolvedValue({
      id: "hotel-access-002",
      name: "Hotel 2",
    } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "hotel-admin-002",
      globalRole: "hotel_admin",
      hotelPermissions: [],
    } as never);
    vi.mocked(prisma.hotelPermission.findFirst).mockResolvedValue(null);

    const tx = {
      hotelPermission: {
        create: vi.fn().mockResolvedValue({
          id: "perm-2",
          userId: "hotel-admin-002",
          hotelId: "hotel-access-002",
          role: "admin",
        }),
      },
    };

    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => callback(tx as never));

    const result = await addUserHotelPermissionAction("hotel-access-002", {
      userId: "hotel-admin-002",
      hotelId: "hotel-access-002",
      role: "admin",
    });

    expect(result).toMatchObject({
      status: "success",
      userId: "hotel-admin-002",
      permissionId: "perm-2",
    });
    expect(tx.hotelPermission.create).toHaveBeenCalledWith({
      data: {
        userId: "hotel-admin-002",
        hotelId: "hotel-access-002",
        role: "admin",
      },
    });
    expect(createAdminUserAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "super-admin-001",
        hotelId: "hotel-access-002",
        action: "hotel.admin_permission.created",
      })
    );
  });

  it("super_admin remove vínculo de hotel_admin e registra auditoria", async () => {
    vi.mocked(requireAuthenticatedRequestUser).mockResolvedValue({
      id: "super-admin-001",
      globalRole: "super_admin",
      isActive: true,
    } as never);
    vi.mocked(prisma.hotel.findUnique).mockResolvedValue({
      id: "hotel-access-002",
      name: "Hotel 2",
    } as never);
    vi.mocked(prisma.hotelPermission.findUnique).mockResolvedValue({
      id: "perm-2",
      userId: "hotel-admin-002",
      hotelId: "hotel-access-002",
      role: "admin",
    } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "hotel-admin-002",
      globalRole: "hotel_admin",
      hotelPermissions: [],
    } as never);

    const tx = {
      hotelPermission: {
        delete: vi.fn().mockResolvedValue({ id: "perm-2" }),
      },
    };

    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => callback(tx as never));

    const result = await removeUserHotelPermissionAction("hotel-access-002", "perm-2");

    expect(result).toMatchObject({
      status: "success",
      permissionId: "perm-2",
    });
    expect(tx.hotelPermission.delete).toHaveBeenCalledWith({
      where: {
        id: "perm-2",
      },
    });
    expect(createAdminUserAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "super-admin-001",
        hotelId: "hotel-access-002",
        action: "hotel.admin_permission.removed",
      })
    );
  });
});
