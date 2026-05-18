import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  requireAuthenticatedRequestUser,
  getRequiredSession,
  AuthenticationError,
} from "@/lib/auth";
import { validateAdminTwoFactor } from "@/lib/auth/admin-security";
import { requireHotelEditAccess } from "@/lib/auth/authorization";
import { AuthorizationError, NotFoundError } from "@/lib/errors/app-error";
import { requireAuthorizedHotelWrite } from "@/lib/hotel-write";

vi.mock("@/lib/auth", async () => {
  const { AuthenticationError } =
    await vi.importActual<typeof import("@/lib/errors/app-error")>("@/lib/errors/app-error");

  return {
    AuthenticationError,
    getRequiredSession: vi.fn(),
    requireAuthenticatedRequestUser: vi.fn(),
  };
});

vi.mock("@/lib/auth/admin-security", () => ({
  validateAdminTwoFactor: vi.fn(),
}));

vi.mock("@/lib/auth/authorization", async () => {
  const { AuthorizationError } =
    await vi.importActual<typeof import("@/lib/errors/app-error")>("@/lib/errors/app-error");

  return {
    AuthorizationError,
    requireHotelAdminAccess: vi.fn(),
    requireHotelEditAccess: vi.fn(),
  };
});

const getSession = vi.mocked(getRequiredSession);
const getUser = vi.mocked(requireAuthenticatedRequestUser);
const validate2fa = vi.mocked(validateAdminTwoFactor);
const requireEdit = vi.mocked(requireHotelEditAccess);

describe("requireAuthorizedHotelWrite", () => {
  beforeEach(() => {
    getSession.mockReset();
    getUser.mockReset();
    validate2fa.mockReset();
    requireEdit.mockReset();

    getSession.mockResolvedValue({
      sub: "admin-1",
      globalRole: "hotel_admin",
      twoFactorVerified: true,
      twoFactorSetupRequired: false,
    });
    getUser.mockResolvedValue({
      id: "admin-1",
      name: "Admin",
      email: "admin@example.com",
      globalRole: "hotel_admin",
      isActive: true,
      emailTwoFactorEnabled: true,
      twoFactorEnabled: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    validate2fa.mockResolvedValue({ success: true });
    requireEdit.mockResolvedValue({
      globalRole: "hotel_admin",
      hotelRole: "editor",
    });
  });

  it("exige sessao autenticada", async () => {
    getSession.mockRejectedValue(new AuthenticationError());

    await expect(requireAuthorizedHotelWrite("hotel-12345")).rejects.toBeInstanceOf(
      AuthenticationError
    );
  });

  it("bloqueia escrita sem 2FA administrativo validado", async () => {
    validate2fa.mockResolvedValue({
      success: false,
      message: "Confirme o código de 2FA para continuar.",
    });

    await expect(requireAuthorizedHotelWrite("hotel-12345")).rejects.toBeInstanceOf(
      AuthorizationError
    );
    expect(requireEdit).not.toHaveBeenCalled();
  });

  it("retorna 404 quando o hotel esta fora do escopo do admin", async () => {
    requireEdit.mockRejectedValue(new AuthorizationError());

    await expect(requireAuthorizedHotelWrite("hotel-fora")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("retorna usuario autenticado quando sessao, 2FA e permissao passam", async () => {
    await expect(requireAuthorizedHotelWrite("hotel-12345")).resolves.toMatchObject({
      id: "admin-1",
      globalRole: "hotel_admin",
    });
  });
});
