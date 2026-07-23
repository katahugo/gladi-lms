/**
 * migrate.mjs — migrasi database produksi TANPA drizzle-kit.
 *
 * drizzle-kit adalah devDependency (tidak ada di image produksi standalone),
 * sehingga `npx drizzle-kit migrate` gagal di dalam container app. Skrip ini
 * memakai migrator bawaan drizzle-orm (dependency produksi) yang di-bundle
 * esbuild menjadi file ESM mandiri.
 *
 * Kredensial dibaca sebagai FIELD TERPISAH (PGUSER/PGPASSWORD/PGDATABASE, dst.)
 * — BUKAN menempelkan password mentah ke DATABASE_URL, karena password dengan
 * karakter khusus merusak decodeURIComponent saat parsing URL (URIError:
 * URI malformed). DATABASE_URL tetap didukung sebagai fallback bila disediakan.
 *
 * Dijalankan oleh: scripts/deploy.sh (container one-shot di network internal).
 */
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

function buildOptions() {
  // Prioritas: field terpisah (aman untuk password berkarakter khusus)
  if (process.env.PGDATABASE) {
    return {
      host: process.env.PGHOST ?? "postgres",
      port: process.env.PGPORT ? Number(process.env.PGPORT) : 5432,
      database: process.env.PGDATABASE,
      username: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      max: 1,
    };
  }
  // Fallback: DATABASE_URL utuh (hanya aman jika password sudah URL-encoded)
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  return null;
}

const options = buildOptions();
if (!options) {
  console.error("[migrate] Kredensial DB belum diset (PGDATABASE atau DATABASE_URL) — dibatalkan");
  process.exit(1);
}

const client = postgres(options);
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
