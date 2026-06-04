import { describe, expect, it } from "vitest";

import { isAdminUserRole } from "@/lib/auth/roles";

describe("isAdminUserRole", () => {
  it("retorna false para usuário comum", () => {
    expect(isAdminUserRole("user")).toBe(false);
  });

  it("retorna true para hotel_admin", () => {
    expect(isAdminUserRole("hotel_admin")).toBe(true);
  });

  it("retorna true para super_admin", () => {
    expect(isAdminUserRole("super_admin")).toBe(true);
  });
});
