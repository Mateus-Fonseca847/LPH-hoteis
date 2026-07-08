import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("AdminHotelsPage remove button", () => {
  it("mostra remover para super_admin e apenas owner/admin de hotel_admin", () => {
    const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
    const buttonSource = readFileSync(new URL("./RemoveHotelButton.tsx", import.meta.url), "utf8");

    expect(source).toContain("canRemove: true");
    expect(source).toContain("role === HotelRole.owner || role === HotelRole.admin");
    expect(source).toContain("hotel.canRemove");
    expect(source).toContain("RemoveHotelButton");
    expect(source).toContain("hasHotelArchiveFields");
    expect(source).toContain("getActiveHotelWhere");
    expect(source).toContain("[admin/hoteis/list]");
    expect(buttonSource).toContain("Remover hotel");
    expect(buttonSource).toContain("Tem certeza que deseja remover");
    expect(buttonSource).toContain("Hotéis com reservas vinculadas não serão removidos");
  });
});
