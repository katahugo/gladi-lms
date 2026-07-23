import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";

import { db } from "@/db";

/**
 * GET /api/health/db — health check DENGAN verifikasi database.
 * Dipakai Uptime Kuma (D3) untuk memastikan koneksi DB hidup, bukan
 * hanya aplikasi yang merespons. Tanpa ini, Uptime Kuma tidak bisa
 * mendeteksi bila Postgres mati sementara app tetap berjalan (health
 * biasa hanya cek aplikasi, bukan DB).
 */
export async function GET() {
  try {
    await db.execute(sql`SELECT 1 AS ok`);
    return NextResponse.json({
      status: "ok",
      db: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      { status: "error", db: "disconnected", timestamp: new Date().toISOString() },
      { status: 503 },
    );
  }
}
