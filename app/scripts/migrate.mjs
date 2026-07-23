/**
 * migrate.mjs — migrasi database produksi TANPA drizzle-kit.
 *
 * drizzle-kit adalah devDependency (tidak ada di image produksi standalone),
 * sehingga `npx drizzle-kit migrate` gagal "Cannot find module 'drizzle-kit'"
 * di dalam container app. Skrip ini memakai migrator bawaan drizzle-orm yang
 * sudah jadi dependency produksi dan ikut ter-bundle di output standalone.
 *
 * Dijalankan oleh: scripts/deploy.sh (container one-shot di network internal),
 * dan bisa juga manual: docker compose run --rm --no-deps app node migrate.mjs
 */
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("[migrate] DATABASE_URL belum diset — migrasi dibatalkan");
  process.exit(1);
}

const client = postgres(url, { max: 1 });
const db = drizzle(client);

try {
  console.log("[migrate] Menjalankan migrasi dari folder ./drizzle ...");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("[migrate] Migrasi selesai.");
} catch (err) {
  console.error("[migrate] GAGAL:", err);
  process.exitCode = 1;
} finally {
  await client.end();
}
