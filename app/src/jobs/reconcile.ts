/**
 * Job BullMQ — rekonsiliasi pembayaran (D4).
 *
 * Mengecek transaksi yang statusnya "pending" lebih dari 1 jam ke Midtrans API
 * untuk memastikan tidak ada pembayaran yang lolos webhook. Dipanggil oleh
 * worker via queue "lms" setiap 15 menit (cron repeatable job).
 */
import { eq, and, lt } from "drizzle-orm";

import { db } from "@/db";
import { transactions } from "@/db/schema";
import { mapMidtransStatus } from "@/lib/payments";

const SERVER_KEY = process.env.MIDTRANS_SERVER_KEY;
const IS_PROD = process.env.MIDTRANS_IS_PRODUCTION === "true";

export async function reconcilePayments(): Promise<{ checked: number; updated: number }> {
  if (!SERVER_KEY) {
    console.log("[reconcile] MIDTRANS_SERVER_KEY belum diset — rekonsiliasi dilewati");
    return { checked: 0, updated: 0 };
  }

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const pendingTxs = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.status, "pending"),
        eq(transactions.paymentGateway, "midtrans"),
        lt(transactions.createdAt, oneHourAgo),
      ),
    );

  if (pendingTxs.length === 0) return { checked: 0, updated: 0 };

  const auth = Buffer.from(`${SERVER_KEY}:`).toString("base64");
  const baseUrl = IS_PROD
    ? "https://api.midtrans.com/v2"
    : "https://api.sandbox.midtrans.com/v2";

  let updated = 0;

  for (const tx of pendingTxs) {
    try {
      const res = await fetch(`${baseUrl}/${tx.gatewayRef}/status`, {
        headers: { Authorization: `Basic ${auth}` },
      });
      if (!res.ok) continue;

      const json = (await res.json()) as {
        transaction_status?: string;
        fraud_status?: string;
        payment_type?: string;
      };
      const newStatus = mapMidtransStatus(
        json.transaction_status ?? "",
        json.fraud_status,
      );

      if (newStatus !== tx.status) {
        await db
          .update(transactions)
          .set({
            status: newStatus,
            paymentMethod: json.payment_type ?? tx.paymentMethod,
            paidAt: newStatus === "paid" ? new Date() : tx.paidAt,
            updatedAt: new Date(),
          })
          .where(eq(transactions.id, tx.id));
        updated++;
        console.log(`[reconcile] ${tx.gatewayRef}: ${tx.status} → ${newStatus}`);
      }
    } catch {
      // Lanjut ke transaksi berikutnya; error individual tidak menghentikan batch
    }
  }

  return { checked: pendingTxs.length, updated };
}
