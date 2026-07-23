/**
 * Entry point worker BullMQ (D4).
 *
 * Queue "lms" dengan 3 jenis job:
 *   - "reconcile"      — rekonsiliasi pembayaran Midtrans (cron: tiap 15 menit)
 *   - "certificate"    — generate sertifikat PDF + email (dipicu oleh endpoint
 *                         /api/certificates via queue.add)
 *   - "email"          — kirim email notifikasi (generic)
 *
 * Semua job bersifat idempoten dan bisa di-retry otomatis oleh BullMQ.
 */
import { Queue, Worker } from "bullmq";
import Redis from "ioredis";

import { reconcilePayments } from "@/jobs/reconcile";
import { generateCertificatePdf } from "@/jobs/certificate";
import { sendEmail, type EmailPayload } from "@/jobs/email";

// Koneksi Redis
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

const queueName = "lms";

// Queue untuk menambah job dari endpoint API (mis. sertifikat, email)
export const queue = new Queue(queueName, { connection });

// Worker yang memproses job dari queue
const worker = new Worker(
  queueName,
  async (job) => {
    const name = job.name;
    const data = job.data as Record<string, unknown>;

    switch (name) {
      case "reconcile": {
        const result = await reconcilePayments();
        console.log(`[worker] reconcile selesai: cek ${result.checked}, update ${result.updated}`);
        return result;
      }
      case "certificate": {
        await generateCertificatePdf(data as unknown as Parameters<typeof generateCertificatePdf>[0]);
        return { ok: true };
      }
      case "email": {
        const sent = await sendEmail(data as EmailPayload);
        return { sent };
      }
      default:
        console.warn(`[worker] Job tidak dikenal: ${name}`, data);
        return { skipped: true };
    }
  },
  {
    connection,
    // Retry: 3x dengan backoff eksponensial (1dtk → 2dtk → 4dtk)
    removeOnComplete: { age: 3600 }, // bersihkan job sukses setelah 1 jam
    removeOnFail: { age: 86400 },    // simpan log gagal 24 jam
  },
);

// Cron job: rekonsiliasi pembayaran tiap 15 menit

async function main() {
  await connection.ping();
  console.log("[worker] Terhubung ke Redis — memproses job queue 'lms'...");

  // Jadwalkan rekonsiliasi berulang
  await queue.add("reconcile", {}, {
    repeat: { every: 15 * 60 * 1000 }, // 15 menit
    jobId: "reconcile-repeat",
    removeOnComplete: true,
  });
  console.log("[worker] Cron reconcile terpasang (tiap 15 menit)");

  worker.on("completed", (job) => {
    console.log(`[worker] ✓ ${job.name}#${job.id}`);
  });
  worker.on("failed", (job, err) => {
    console.error(`[worker] ✗ ${job?.name ?? "?"}#${job?.id ?? "?"}:`, err.message);
  });

  const shutdown = async (signal: string) => {
    console.log(`[worker] Menerima ${signal} — shutdown graceful...`);
    await worker.close();
    await queue.close();
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
