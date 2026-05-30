import { describe, expect, it } from "vitest";

import {
  assertCanManageAdministrativeTarget,
  canManageAdministrativeTarget,
} from "@/lib/auth/admin-permissions";
import { AuthorizationError, NotFoundError } from "@/lib/errors/app-error";

describe("admin user management permissions", () => {
  it("permite super_admin gerenciar usuários administrativos ou vínculos legados", () => {
    expect(
      canManageAdministrativeTarget({ globalRole: "super_admin" }, { globalRole: "hotel_admin" })
    ).toBe(true);
    expect(
      canManageAdministrativeTarget({ globalRole: "super_admin" }, { globalRole: "super_admin" })
    ).toBe(true);
    expect(
      canManageAdministrativeTarget({ globalRole: "super_admin" }, { globalRole: "user" })
    ).toBe(true);
  });

  it("impede hotel_admin de gerenciar super_admin", () => {
    expect(() =>
      assertCanManageAdministrativeTarget(
        { globalRole: "hotel_admin" },
        { globalRole: "super_admin" }
      )
    ).toThrow(NotFoundError);
  });

  it("impede hotel_admin de gerenciar usuário comum", () => {
    expect(() =>
      assertCanManageAdministrativeTarget({ globalRole: "hotel_admin" }, { globalRole: "user" })
    ).toThrow(AuthorizationError);
  });

  it("permite hotel_admin gerenciar outro hotel_admin dentro do escopo validado pela action", () => {
    expect(
      canManageAdministrativeTarget({ globalRole: "hotel_admin" }, { globalRole: "hotel_admin" })
    ).toBe(true);
  });
});
