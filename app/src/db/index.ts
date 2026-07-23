import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Koneksi database PostgreSQL.
 *
 * Kredensial dibaca sebagai FIELD TERPISAH (PGHOST/PGUSER/PGPASSWORD/PGDATABASE)
 * — BUKAN menempelkan password mentah ke DATABASE_URL, karena password dengan
 * karakter khusus merusak parsing URL (URIError: URI malformed). DATABASE_URL
 * tetap didukung sebagai fallback (mis. untuk development lokal).
 *
 * Driver: postgres.js (ringan, cocok untuk serverless & standalone).
 * Catatan: saat `next build`, kredensial boleh kosong — koneksi lazy, baru
 * benar-benar dipakai saat query pertama.
 */
function buildClient() {
  const common = { max: 10, prepare: true };

  if (process.env.PGDATABASE || process.env.PGHOST) {
    return postgres({
      ...common,
      host: process.env.PGHOST ?? "localhost",
      port: process.env.PGPORT ? Number(process.env.PGPORT) : 5432,
      database: process.env.PGDATABASE ?? "placeholder",
      username: process.env.PGUSER ?? "placeholder",
      password: process.env.PGPASSWORD ?? "placeholder",
    });
  }
  const url =
    process.env.DATABASE_URL ??
    "postgresql://placeholder:placeholder@localhost:5432/placeholder";
  return postgres(url, common);
}

// max: 10 koneksi per container — total app+worker (20) masih di bawah
// max_connections=50 Postgres (lihat docker-compose.yml tuning)
const client = buildClient();

export const db = drizzle(client, { schema });
