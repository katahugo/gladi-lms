import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { courses } from "@/db/schema";
import { validateCoupon } from "@/lib/coupons";
import { auth } from "@/auth";

/**
 * POST /api/coupons/validate — cek kupon + harga final (dipakai UI checkout).
 * Body: { code: string, courseId: string }
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Silakan login terlebih dahulu" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body bukan JSON valid" }, { status: 400 });
  }
  const { code, courseId } = (body ?? {}) as Record<string, unknown>;
  if (typeof code !== "string" || typeof courseId !== "string") {
    return NextResponse.json({ error: "code dan courseId wajib diisi" }, { status: 400 });
  }

  const course = await db.query.courses.findFirst({ where: eq(courses.id, courseId) });
  if (!course) return NextResponse.json({ error: "Kursus tidak ditemukan" }, { status: 404 });

  const result = await validateCoupon(code, courseId, course.price);
  if (!result.valid) {
    return NextResponse.json({ valid: false, reason: result.reason });
  }

  return NextResponse.json({
    valid: true,
    code: result.coupon!.code,
    originalPrice: course.price,
    discountAmount: result.discountAmount,
    finalPrice: result.finalPrice,
  });
}
