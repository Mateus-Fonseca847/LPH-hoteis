import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("AdminHotelDetailPage markup", () => {
  it("reutiliza o workspace compartilhado e mantém pagamentos fora da edição", () => {
    const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
    const workspaceSource = readFileSync(
      new URL("../HotelManagementWorkspace.tsx", import.meta.url),
      "utf8"
    );

    expect(source).toContain("HotelManagementWorkspace");
    expect(source).toContain("requireHotelEditAccess(user.id, id)");
    expect(source).toContain("Hotel indisponível para edição");
    expect(source).toContain("HotelApprovalReview");
    expect(source).toContain("approveHotelAction");
    expect(source).toContain('user.globalRole === "super_admin" ? approveHotelAction.bind');
    expect(source).toContain('canPublish={user.globalRole === "super_admin"}');
    expect(source).not.toContain("HotelPaymentSettingsForm");
    expect(source).not.toContain("Pagamentos");
    expect(workspaceSource).toContain("IconBackLink");
    expect(workspaceSource).toContain("ariaLabel={backLabel}");
  });
});
