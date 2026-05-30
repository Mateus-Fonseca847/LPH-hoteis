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
        "src/lib/availability-results.ts",
        "src/lib/auth/authorization.ts",
        "src/lib/auth/admin-permissions.ts",
        "src/lib/hotel-search.ts",
        "src/lib/normalize-text.ts",
        "src/lib/profile-recommendations.ts",
        "src/lib/stay-query.ts",
      ],
      exclude: ["src/**/*.test.ts"],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
