/**
 * Entry point worker BullMQ — placeholder untuk A7 (agar pipeline CI/CD
 * bisa membuild target `worker` di Dockerfile).
 *
 * Implementasi job sesungguhnya (rekonsiliasi pembayaran, generate sertifikat,
 * kirim email) dibuat di langkah D4.
 */
import Redis from "ioredis";

// Baca kredensial dari field terpisah (bukan URL) agar password dengan karakter
// khusus tidak merusak parsing. Fallback ke REDIS_URL bila disediakan.
const redisUrl = process.env.REDIS_URL;
const host = process.env.REDIS_HOST;
const port = process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : 6379;
const password = process.env.REDIS_PASSWORD;

if (!redisUrl && !host) {
  console.error("REDIS_HOST (atau REDIS_URL) belum diset — worker berhenti");
  process.exit(1);
}

const connection = redisUrl
  ? new Redis(redisUrl, { maxRetriesPerRequest: null })
  : new Redis({ host, port, password, maxRetriesPerRequest: null });

async function main() {
  await connection.ping();
  console.log("[worker] Terhubung ke Redis — menunggu job (queue dibuat di D4)...");

  // Keep-alive: worker tetap berjalan menunggu implementasi queue di D4
  const keepAlive = setInterval(() => {
    connection.ping().catch((err) => {
      console.error("[worker] Redis ping gagal:", err.message);
    });
  }, 30_000);

  const shutdown = async (signal: string) => {
    console.log(`[worker] Menerima ${signal} — shutdown graceful...`);
    clearInterval(keepAlive);
    await connection.quit();
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((err) => {
  console.error("[worker] Gagal start:", err);
  process.exit(1);
});
