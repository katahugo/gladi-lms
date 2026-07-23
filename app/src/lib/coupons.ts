import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { coupons } from "@/db/schema";

/**
 * Helper kupon (E4) — validasi & perhitungan diskon.
 */

export interface CouponCheckResult {
  valid: boolean;
  reason?: string;
  coupon?: typeof coupons.$inferSelect;
  /** Harga setelah diskon (integer Rupiah, min 0). */
  finalPrice?: number;
  discountAmount?: number;
}

export async function validateCoupon(
  code: string,
  courseId: string,
  originalPrice: number,
): Promise<CouponCheckResult> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return { valid: false, reason: "Kode kupon kosong" };

  const coupon = await db.query.coupons.findFirst({
    where: eq(coupons.code, normalized),
  });
  if (!coupon) return { valid: false, reason: "Kode kupon tidak ditemukan" };
  if (!coupon.isActive) return { valid: false, reason: "Kupon sudah tidak aktif" };

  if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
    return { valid: false, reason: "Kupon sudah kedaluwarsa" };
  }
  if (coupon.courseId && coupon.courseId !== courseId) {
    return { valid: false, reason: "Kupon tidak berlaku untuk kursus ini" };
  }
  if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
    return { valid: false, reason: "Kuota pemakaian kupon habis" };
  }

  let discountAmount: number;
  if (coupon.discountType === "percent") {
    discountAmount = Math.floor((originalPrice * coupon.value) / 100);
  } else {
    discountAmount = coupon.value;
  }
  // Diskon tidak boleh melebihi harga (harga final min 0)
  discountAmount = Math.min(discountAmount, originalPrice);
  const finalPrice = originalPrice - discountAmount;

  return { valid: true, coupon, finalPrice, discountAmount };
}

/**
 * Catat pemakaian kupon (increment usedCount secara atomik).
 * Dipanggil setelah transaksi dibuat.
 */
export async function incrementCouponUsage(couponId: string): Promise<void> {
  await db
    .update(coupons)
    .set({ usedCount: sql`${coupons.usedCount} + 1` })
    .where(eq(coupons.id, couponId));
}
