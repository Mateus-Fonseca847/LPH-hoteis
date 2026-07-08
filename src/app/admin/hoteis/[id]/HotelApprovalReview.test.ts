import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("HotelApprovalReview markup", () => {
  it("mostra aprovação/publicação separada do envio para aprovação", () => {
    const source = readFileSync(new URL("./HotelApprovalReview.tsx", import.meta.url), "utf8");

    expect(source).toContain("Aprovar e publicar");
    expect(source).toContain("canApproveAndPublish");
    expect(source).toContain("Somente o super administrador pode aprovar e publicar este hotel.");
    expect(source).toContain("Informações recomendadas");
    expect(source).toContain("admin-editor-banner--info");
    expect(source).toContain("Aguardando envio para aprovação.");
    expect(source).toContain("Status: Publicado.");
  });
});
