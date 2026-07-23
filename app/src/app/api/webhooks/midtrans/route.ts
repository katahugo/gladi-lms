import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { transactions, enrollments } from "@/db/schema";
import { mapMidtransStatus, verifyMidtransSignature } from "@/lib/payments";

/**
 * POST /api/webhooks/midtrans — terima notifikasi status pembayaran.
 *
 * Keamanan & keandalan (PRD §5.5, §10):
 *   1. Verifikasi signature_key (SHA512) — tolak payload palsu.
 *   2. Idempoten: hanya proses bila status transaksi berubah; partial unique
 *      index transactions_paid_unique mencegah enrollment ganda.
 *   3. Selalu balas 200 cepat agar gateway tidak retry berlebihan; error
 *      yang bisa di-retry dicatat (rekonsiliasi harian di D4 sebagai cadangan).
 *   4. Enrollment dibuat dalam transaksi DB yang sama dengan update status,
 *      sehingga atomik.
 */
export async function POST(req: Request) {
  let payload: Record<string, unknown>;
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Payload bukan JSON valid" }, { status: 400 });
  }

  const orderId = String(payload.order_id ?? "");
  const transactionStatus = String(payload.transaction_status ?? "");
  const fraudStatus = payload.fraud_status ? String(payload.fraud_status) : undefined;

  // 1. Verifikasi signature
  const valid = verifyMidtransSignature({
    order_id: orderId,
    status_code: String(payload.status_code ?? ""),
    gross_amount: String(payload.gross_amount ?? ""),
    signature_key: String(payload.signature_key ?? ""),
  });
  if (!valid) {
    return NextResponse.json({ error: "Signature tidak valid" }, { status: 401 });
  }

  // Cari transaksi berdasarkan order_id (gatewayRef)
  const tx = await db.query.transactions.findFirst({
    where: eq(transactions.gatewayRef, orderId),
  });
  if (!tx) {
    // Balas 200 agar gateway berhenti retry; transaksi tak dikenal dicatat untuk rekonsiliasi
    console.warn(`[webhook] order_id tidak dikenal: ${orderId}`);
    return NextResponse.json({ received: true, note: "unknown order_id" });
  }

  const newStatus = mapMidtransStatus(transactionStatus, fraudStatus);

  // 2. Idempoten: tidak ada perubahan status → tidak perlu proses
  if (tx.status === newStatus) {
    return NextResponse.json({ received: true, note: "no status change" });
  }

  try {
    await db.transaction(async (trx) => {
      // Update status transaksi
      await trx
        .update(transactions)
        .set({
          status: newStatus,
          paymentMethod: payload.payment_type ? String(payload.payment_type) : tx.paymentMethod,
          paidAt: newStatus === "paid" ? new Date() : tx.paidAt,
          updatedAt: new Date(),
        })
        .where(eq(transactions.id, tx.id));

      // Bila lunas → buat enrollment aktif (INSERT ... ON CONFLICT DO NOTHING
      // agar webhook duplikat tidak membuat enrollment ganda)
      if (newStatus === "paid") {
        await trx
          .insert(enrollments)
          .values({
            userId: tx.userId,
            courseId: tx.courseId,
            status: "active",
          })
          .onConflictDoNothing();
      }
    });

    return NextResponse.json({ received: true, status: newStatus });
  } catch (err) {
    // Partial unique index (paid) melindungi dari duplikat; konflik dianggap idempotent-ok
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("transactions_paid_unique") || msg.includes("duplicate key")) {
      return NextResponse.json({ received: true, note: "already processed" });
    }
    console.error(`[webhook] gagal proses ${orderId}:`, err);
    return NextResponse.json({ error: "Gagal memproses webhook" }, { status: 500 });
  }
}
