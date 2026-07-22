/**
 * Skrip migrasi database — dijalankan di VPS oleh pipeline CI/CD
 * (step sebelum `docker compose up -d`), BUKAN di CI runner,
 * karena database tidak diekspos ke internet.
 *
 * Menggunakan drizzle-kit migrate via npx dengan DATABASE_URL dari environment.
 */
import { execSync } from "node:child_process";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL belum diset — migrasi dibatalkan");
  process.exit(1);
}

console.log("Menjalankan migrasi database...");
execSync("npx drizzle-kit migrate", { stdio: "inherit" });
console.log("Migrasi selesai.");
