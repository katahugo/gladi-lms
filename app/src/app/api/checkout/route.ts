import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { auth } from "@/auth";
import { db } from "@/db";
import { courses, transactions, enrollments } from "@/db/schema";
import { createSnapTransaction, isMidtransConfigured } from "@/lib/payments";

/**
 * POST /api/checkout — buat transaksi pembelian kursus.
 * Body: { courseId: string }
 *
 * Alur:
 *   1. Validasi login + kursus published
 *   2. Tolak bila sudah enrollment aktif (sudah punya akses)
 *   3. Idempotensi: kembalikan transaksi pending yang sudah ada bila masih valid
 *   4. Buat order_id unik + transaksi Snap di Midtrans
 *   5. Simpan transaksi (status pending) + kembalikan paymentUrl
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Silakan login terlebih dahulu" }, { status: 401 });
  }
  if (!isMidtransConfigured()) {
    return NextResponse.json({ error: "Payment gateway belum dikonfigurasi (MIDTRANS_SERVER_KEY)" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body bukan JSON valid" }, { status: 400 });
  }
  const { courseId } = (body ?? {}) as Record<string, unknown>;
  if (typeof courseId !== "string") {
    return NextResponse.json({ error: "courseId wajib diisi" }, { status: 400 });
  }

  const course = await db.query.courses.findFirst({ where: eq(courses.id, courseId) });
  if (!course || course.status !== "published") {
    return NextResponse.json({ error: "Kursus tidak ditemukan" }, { status: 404 });
  }

  const userId = session.user.id;

  // Sudah punya akses?
  const existingEnrollment = await db.query.enrollments.findFirst({
    where: and(
      eq(enrollments.userId, userId),
      eq(enrollments.courseId, courseId),
      eq(enrollments.status, "active"),
    ),
  });
  if (existingEnrollment) {
    return NextResponse.json({ error: "Anda sudah terdaftar di kursus ini" }, { status: 409 });
  }

  // Kursus gratis → langsung enrollment tanpa pembayaran
  if (course.price === 0) {
    await db.insert(enrollments).values({
      userId,
      courseId,
      status: "active",
    });
    return NextResponse.json({ free: true, enrolled: true });
  }

  // Idempotensi: kembalikan transaksi pending yang sudah ada (hindari duplikat order)
  const existingPending = await db.query.transactions.findFirst({
    where: and(
      eq(transactions.userId, userId),
      eq(transactions.courseId, courseId),
      eq(transactions.status, "pending"),
    ),
  });
  if (existingPending?.paymentUrl) {
    return NextResponse.json({
      orderId: existingPending.gatewayRef,
      paymentUrl: existingPending.paymentUrl,
      reused: true,
    });
  }

  // Buat order_id unik & deterministik-ish untuk rekonsiliasi
  const orderId = `GLD-${Date.now()}-${userId.substring(0, 8)}`;

  try {
    const snap = await createSnapTransaction({
      orderId,
      grossAmount: course.price,
      customerName: session.user.name ?? "Siswa",
      customerEmail: session.user.email ?? "",
      itemName: course.title,
    });

    await db.insert(transactions).values({
      userId,
      courseId,
      amount: course.price,
      paymentGateway: "midtrans",
      gatewayRef: orderId,
      paymentUrl: snap.redirectUrl,
      status: "pending",
    });

    return NextResponse.json({ orderId, paymentUrl: snap.redirectUrl, token: snap.token }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Gagal membuat transaksi";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
