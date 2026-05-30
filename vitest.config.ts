import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: [
        "src/app/api/reservas/route.ts",
        "src/lib/auth/authorization.ts",
        "src/lib/auth/two-factor.ts",
        "src/lib/payments/mercado-pago.ts",
        "src/lib/profile-recommendations.ts",
        "src/lib/reservation-confirmation.ts",
        "src/lib/stay-query.ts",
        "src/lib/validations/reservation.ts",
      ],
      exclude: ["src/**/*.test.ts"],
    },
  },
});
