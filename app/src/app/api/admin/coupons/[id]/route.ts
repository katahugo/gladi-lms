import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { coupons } from "@/db/schema";
import { requireRole } from "@/lib/guards";

/**
 * PATCH /api/admin/coupons/[id] — aktif/nonaktifkan atau edit kupon.
 * Body: { isActive? } (bisa diperluas untuk edit field lain)
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireRole(["admin"]);
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body bukan JSON valid" }, { status: 400 });
  }
  const { isActive } = (body ?? {}) as { isActive?: boolean };
  if (typeof isActive !== "boolean") {
    return NextResponse.json({ error: "isActive wajib boolean" }, { status: 400 });
  }

  await db.update(coupons).set({ isActive }).where(eq(coupons.id, id));
  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/admin/coupons/[id] — hapus kupon.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireRole(["admin"]);
  const { id } = await params;
  await db.delete(coupons).where(eq(coupons.id, id));
  return NextResponse.json({ ok: true });
}
