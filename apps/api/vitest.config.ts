import { defineConfig } from "vitest/config";

// Tests run against their own database and never use real SMS/S3 credentials.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    env: {
      NODE_ENV: "test",
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ?? "postgresql://coffee:coffee@localhost:5433/coffee_test",
      JWT_SECRET: "test-jwt-secret-test-jwt-secret-1234567890",
      ORG_PROVISIONING_SECRET: "test-provisioning-secret-1234567890",
      AFRICASTALKING_USERNAME: "",
      AFRICASTALKING_API_KEY: "",
      S3_BUCKET: "",
      S3_ACCESS_KEY_ID: "",
      S3_SECRET_ACCESS_KEY: "",
      CORS_ORIGINS: "",
    },
  },
});
