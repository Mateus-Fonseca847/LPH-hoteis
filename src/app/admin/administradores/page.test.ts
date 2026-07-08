import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("AdminAdministratorsPage markup", () => {
  it("restringe a tela a super_admin e expõe a gestão de hotéis por hotel_admin", () => {
    const pageSource = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
    const clientSource = readFileSync(new URL("./AdminUsersClient.tsx", import.meta.url), "utf8");

    expect(pageSource).toContain('user.globalRole !== "super_admin"');
    expect(pageSource).toContain(
      "Somente o super administrador pode definir quais hotéis cada administrador do hotel gerencia."
    );
    expect(clientSource).toContain("Adicionar hotel");
    expect(clientSource).toContain("Criar administrador");
    expect(clientSource).toContain("addUserHotelPermissionAction");
    expect(clientSource).toContain("removeUserHotelPermissionAction");
  });
});
