import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { auth } from "@/auth";
import { db } from "@/db";
import { courses, transactions, enrollments } from "@/db/schema";
import { createSnapTransaction, isMidtransConfigured } from "@/lib/payments";
import { incrementCouponUsage, validateCoupon } from "@/lib/coupons";

/**
 * POST /api/checkout — buat transaksi pembelian kursus.
 * Body: { courseId: string, couponCode?: string }
 *
 * Alur:
 *   1. Validasi login + kursus published
 *   2. Tolak bila sudah enrollment aktif (sudah punya akses)
 *   3. Validasi kupon (bila ada) → harga final setelah diskon
 *   4. Harga final 0 → langsung enrollment (diskon 100% / kursus gratis)
 *   5. Idempotensi: kembalikan transaksi pending yang sudah ada bila masih valid
 *   6. Buat order_id unik + transaksi Snap di Midtrans (dengan harga final)
 *   7. Simpan transaksi (status pending) + kembalikan paymentUrl
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
  const { courseId, couponCode } = (body ?? {}) as Record<string, unknown>;
  if (typeof courseId !== "string") {
    return NextResponse.json({ error: "courseId wajib diisi" }, { status: 400 });
  }

  const course = await db.query.courses.findFirst({ where: eq(courses.id, courseId) });
  if (!course || course.status !== "published") {
    return NextResponse.json({ error: "Kursus tidak ditemukan" }, { status: 404 });
  }

  const userId = session.user.id;

  // Validasi kupon (bila diberikan) — hitung harga final
  let finalPrice = course.price;
  let appliedCoupon: Awaited<ReturnType<typeof validateCoupon>> | null = null;
  if (typeof couponCode === "string" && couponCode.trim()) {
    appliedCoupon = await validateCoupon(couponCode, courseId, course.price);
    if (!appliedCoupon.valid) {
      return NextResponse.json({ error: appliedCoupon.reason }, { status: 400 });
    }
    finalPrice = appliedCoupon.finalPrice!;
  }

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

  // Harga final 0 (kursus gratis atau diskon 100%) → langsung enrollment
  if (finalPrice === 0) {
    await db.transaction(async (trx) => {
      await trx.insert(enrollments).values({
        userId,
        courseId,
        status: "active",
      });
    });
    if (appliedCoupon?.coupon) {
      await incrementCouponUsage(appliedCoupon.coupon.id);
    }
    return NextResponse.json({ free: true, enrolled: true, couponApplied: Boolean(appliedCoupon) });
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
      grossAmount: finalPrice,
      customerName: session.user.name ?? "Siswa",
      customerEmail: session.user.email ?? "",
      itemName: course.title,
    });

    await db.insert(transactions).values({
      userId,
      courseId,
      amount: finalPrice,
      paymentGateway: "midtrans",
      gatewayRef: orderId,
      paymentUrl: snap.redirectUrl,
      status: "pending",
    });

    if (appliedCoupon?.coupon) {
      await incrementCouponUsage(appliedCoupon.coupon.id);
    }

    return NextResponse.json({
      orderId,
      paymentUrl: snap.redirectUrl,
      token: snap.token,
      amount: finalPrice,
      discountAmount: appliedCoupon?.discountAmount ?? 0,
      couponApplied: Boolean(appliedCoupon),
    }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Gagal membuat transaksi";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
