import { describe, expect, it } from "vitest";

import { getTwoFactorLoginState, isTwoFactorRequiredForUser } from "@/lib/auth/two-factor";
import { InternalServerError } from "@/lib/errors/app-error";

describe("admin 2FA rules", () => {
  it("exige 2FA TOTP apenas para admins com flag legada ativa", () => {
    expect(
      isTwoFactorRequiredForUser({
        globalRole: "super_admin",
        twoFactorEnabled: true,
      })
    ).toBe(true);
    expect(
      isTwoFactorRequiredForUser({
        globalRole: "hotel_admin",
        twoFactorEnabled: true,
      })
    ).toBe(true);
    expect(
      isTwoFactorRequiredForUser({
        globalRole: "user",
        twoFactorEnabled: true,
      })
    ).toBe(false);
    expect(
      isTwoFactorRequiredForUser({
        globalRole: "hotel_admin",
        twoFactorEnabled: false,
      })
    ).toBe(false);
  });

  it("faz bypass quando 2FA TOTP nao e exigido", () => {
    expect(
      getTwoFactorLoginState({
        id: "user-1",
        email: "user@example.com",
        globalRole: "user",
        twoFactorEnabled: true,
        twoFactorSecret: null,
      })
    ).toEqual({ mode: "bypass" });
  });

  it("retorna erro seguro quando admin tem 2FA ativo sem segredo", () => {
    const result = getTwoFactorLoginState({
      id: "admin-1",
      email: "admin@example.com",
      globalRole: "hotel_admin",
      twoFactorEnabled: true,
      twoFactorSecret: null,
    });

    expect(result.mode).toBe("error");
    if (result.mode === "error") {
      expect(result.error).toBeInstanceOf(InternalServerError);
      expect(result.error.exposeMessage).toBe(true);
    }
  });
});
