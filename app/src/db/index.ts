import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Koneksi database PostgreSQL.
 * DATABASE_URL di-inject via environment (docker-compose / .env lokal).
 * Driver: postgres.js (ringan, cocok untuk serverless & standalone).
 *
 * Catatan: saat `next build`, DATABASE_URL boleh kosong (Dockerfile memberi
 * placeholder) — koneksi lazy, baru benar-benar dipakai saat query pertama.
 * Runtime production tanpa DATABASE_URL akan gagal saat query, bukan saat import.
 */
const connectionString =
  process.env.DATABASE_URL ?? "postgresql://placeholder:placeholder@localhost:5432/placeholder";

// max: 10 koneksi per container — total app+worker (20) masih di bawah
// max_connections=50 Postgres (lihat docker-compose.yml tuning)
const client = postgres(connectionString, {
  max: 10,
  prepare: true,
});

export const db = drizzle(client, { schema });
