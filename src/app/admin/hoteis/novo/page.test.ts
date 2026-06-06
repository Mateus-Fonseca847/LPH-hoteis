import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("NewHotelPage markup", () => {
  it("reutiliza o workspace compartilhado e iguala galeria, comodidades e políticas à edição", () => {
    const pageSource = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
    const formSource = readFileSync(new URL("./CreateHotelForm.tsx", import.meta.url), "utf8");

    expect(pageSource).toContain("HotelManagementWorkspace");
    expect(pageSource).toContain("Quartos");
    expect(pageSource).toContain("Tarifas");
    expect(pageSource).toContain("Disponibilidade");

    expect(formSource).toContain("Dados principais");
    expect(formSource).toContain("Localização");
    expect(formSource).toContain("Contato");
    expect(formSource).toContain("Descrições");
    expect(formSource).toContain("Galeria");
    expect(formSource).toContain("Comodidades");
    expect(formSource).toContain("Políticas");
    expect(formSource).toContain("Experiências próximas");
    expect(formSource).toContain("HotelGalleryEditor");
    expect(formSource).toContain("coverImageUrl={coverImageUrl}");
    expect(formSource).toContain("router.push(`/admin/hoteis/${state.hotelId}`)");
    expect(formSource).toContain("HotelAmenitiesSelector");
    expect(formSource).toContain("HotelPoliciesEditor");
    expect(formSource).not.toContain('name="galleryImages"');
    expect(formSource).not.toContain("Uma comodidade por linha");
    expect(formSource).not.toContain("Uma política por linha");
    expect(formSource).not.toContain("Pagamentos");
  });
});
