import { beforeEach } from "vitest";

const CLEARED_PREFIXES = ["PAYMENT_", "MERCADO_PAGO_", "STRIPE_"];
const CLEARED_NAMES = ["INTERNAL_API_TOKEN", "CRON_SECRET"];

export function clearPaymentEnv(env: NodeJS.ProcessEnv = process.env) {
  for (const name of Object.keys(env)) {
    if (
      CLEARED_NAMES.includes(name) ||
      CLEARED_PREFIXES.some((prefix) => name.startsWith(prefix))
    ) {
      delete env[name];
    }
  }
}

// Mantém os testes herméticos: variáveis de pagamento do ambiente externo (ex.: CI)
// não vazam para os testes. Testes que precisam delas devem defini-las com vi.stubEnv.
beforeEach(() => {
  clearPaymentEnv();
});
