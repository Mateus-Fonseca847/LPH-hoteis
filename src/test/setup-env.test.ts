import { describe, expect, it } from "vitest";

const PRESERVED = ["CI", "DATABASE_URL", "RUN_DATABASE_TESTS"] as const;
const originalPreserved = PRESERVED.map((name) => [name, process.env[name]] as const);

const CLEARED = [
  "PAYMENT_ACCESS_TOKEN",
  "PAYMENT_SECRETS_ENCRYPTION_KEY",
  "MERCADO_PAGO_ACCESS_TOKEN",
  "STRIPE_SECRET_KEY",
  "INTERNAL_API_TOKEN",
  "CRON_SECRET",
] as const;

describe("setup de ambiente dos testes", () => {
  it("permite que um teste defina variáveis de pagamento", () => {
    for (const name of CLEARED) {
      process.env[name] = "valor-falso-de-teste";
    }

    expect(process.env.PAYMENT_ACCESS_TOKEN).toBe("valor-falso-de-teste");
  });

  it("remove as variáveis de pagamento definidas no teste anterior", () => {
    for (const name of CLEARED) {
      expect(process.env[name], name).toBeUndefined();
    }
  });

  it("não altera CI, DATABASE_URL nem RUN_DATABASE_TESTS", () => {
    for (const [name, value] of originalPreserved) {
      expect(process.env[name], name).toBe(value);
    }
  });
});
