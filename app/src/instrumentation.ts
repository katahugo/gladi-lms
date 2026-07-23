import * as Sentry from "@sentry/nextjs";

/**
 * Sentry instrumentation (D3) — error tracking di sisi server.
 * Hanya aktif bila SENTRY_DSN diisi di environment.
 *
 * Sentry dipasang sebagai file instrumentation Next.js (otomatis di-load
 * oleh framework saat server start). Tanpa SENTRY_DSN, sentry tetap
 * terinisialisasi tapi tidak mengirim apa pun (no-op).
 */
export async function register() {
  if (process.env.SENTRY_DSN) {
    if (process.env.NEXT_RUNTIME === "nodejs") {
      Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.NODE_ENV ?? "production",
        // Hanya kirim sampel error di production (10%) agar tidak
        // menghabiskan kuota free tier
        tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
      });
    }
    if (process.env.NEXT_RUNTIME === "edge") {
      Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.NODE_ENV ?? "production",
        tracesSampleRate: 0,
      });
    }
  }
}
