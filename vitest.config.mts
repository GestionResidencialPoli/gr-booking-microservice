import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    env: {
      JWT_SECRET: "test-jwt-secret-de-al-menos-32-caracteres",
      JWT_ENCRYPTION_KEY: "Y2xhdmUtZGUtcHJ1ZWJhcy1kZS0zMi1ieXRlcy1vayE",
      DB_USERNAME: "test",
      DB_PASSWORD: "test",
      INTERNAL_SERVICE_TOKEN: "test-internal-service-token-de-32-caracteres",
    },
  },
});
