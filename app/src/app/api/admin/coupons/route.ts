import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { coupons } from "@/db/schema";
import { requireRole } from "@/lib/guards";

/**
 * GET /api/admin/coupons — daftar semua kupon (admin).
 */
export async function GET() {
  await requireRole(["admin"]);
  const rows = await db.select().from(coupons).orderBy(desc(coupons.createdAt));
  return NextResponse.json({ coupons: rows });
}

/**
 * POST /api/admin/coupons — buat kupon baru (admin).
 * Body: { code, discountType: "percent"|"fixed", value, maxUses?, courseId?, expiresAt? }
 */
export async function POST(req: Request) {
  await requireRole(["admin"]);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body bukan JSON valid" }, { status: 400 });
  }
  const { code, discountType, value, maxUses, courseId, expiresAt } = (body ?? {}) as Record<string, unknown>;

  if (typeof code !== "string" || code.trim().length < 3) {
    return NextResponse.json({ error: "Kode kupon minimal 3 karakter" }, { status: 400 });
  }
  if (discountType !== "percent" && discountType !== "fixed") {
    return NextResponse.json({ error: "discountType harus percent/fixed" }, { status: 400 });
  }
  const val = Number(value);
  if (!Number.isInteger(val) || val <= 0) {
    return NextResponse.json({ error: "value harus integer > 0" }, { status: 400 });
  }
  if (discountType === "percent" && val > 100) {
    return NextResponse.json({ error: "Diskon persen maksimal 100" }, { status: 400 });
  }

  const normalized = code.trim().toUpperCase();
  const existing = await db.query.coupons.findFirst({ where: eq(coupons.code, normalized) });
  if (existing) {
    return NextResponse.json({ error: "Kode kupon sudah dipakai" }, { status: 409 });
  }

  const [created] = await db
    .insert(coupons)
    .values({
      code: normalized,
      discountType,
      value: val,
      maxUses: typeof maxUses === "number" && maxUses > 0 ? Math.round(maxUses) : null,
      courseId: typeof courseId === "string" && courseId ? courseId : null,
      expiresAt: typeof expiresAt === "string" && expiresAt ? new Date(expiresAt) : null,
      isActive: true,
    })
    .returning();

  return NextResponse.json({ coupon: created }, { status: 201 });
}
