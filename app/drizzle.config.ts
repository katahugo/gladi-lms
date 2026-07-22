import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    // Nilai asli dibaca dari environment saat migrate/push dijalankan
    url: process.env.DATABASE_URL ?? "",
  },
  verbose: true,
  strict: true,
});
