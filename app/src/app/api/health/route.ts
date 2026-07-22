import { NextResponse } from "next/server";

/**
 * Endpoint health-check.
 * Dipakai oleh: healthcheck container Docker, Nginx (/api/health), Uptime Kuma.
 * Tidak menyentuh database — cek koneksi DB dilakukan di /api/health/db (A5).
 */
export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      service: "gladi-lms",
      timestamp: new Date().toISOString(),
    },
    { status: 200 },
  );
}
