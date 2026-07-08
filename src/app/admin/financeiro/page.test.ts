import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("AdminFinancePage", () => {
  it("bloqueia acesso direto de hotel_admin", () => {
    const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

    expect(source).toContain('requireAdminRouteSession("/admin/financeiro")');
    expect(source).toContain('user.globalRole === "super_admin"');
    expect(source).toContain("if (!isSuperAdmin)");
    expect(source).toContain("return <AdminAccessDenied />");
  });
});
