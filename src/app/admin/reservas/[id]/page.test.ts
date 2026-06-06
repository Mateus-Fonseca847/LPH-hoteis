import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("AdminReservationDetailPage markup", () => {
  it("mantem apenas status atual, cancelamento e remarcacao nas acoes operacionais", () => {
    const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

    expect(source).toContain("Acoes operacionais");
    expect(source).toContain("Status atual");
    expect(source).toContain("Novo status do pagamento");
    expect(source).toContain("Motivo da alteração");
    expect(source).toContain("Atualizar pagamento");
    expect(source).toContain('name="operation" value="update-payment-status"');
    expect(source).toContain("Cancelar reserva");
    expect(source).toContain("Remarcar reserva");
    expect(source).not.toContain("Confirmar manualmente");
    expect(source).not.toContain("Marcar pagamento como falho");
    expect(source).not.toContain("Reenviar e-mail de confirmação");
    expect(source).not.toContain("Adicionar observação interna");
  });
});
