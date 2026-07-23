import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";
import { requireRole } from "@/lib/guards";

const VALID_ROLES = ["student", "instructor", "admin", "support"] as const;

/**
 * PATCH /api/admin/users/[id] — ubah role user (khusus admin).
 * Body: { role: "student" | "instructor" | "admin" | "support" }
 * Admin tidak bisa mengubah role dirinya sendiri (mencegah lockout).
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const me = await requireRole(["admin"]);
  const { id } = await params;

  if (id === me.id) {
    return NextResponse.json({ error: "Tidak bisa mengubah role diri sendiri" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body bukan JSON valid" }, { status: 400 });
  }
  const { role } = (body ?? {}) as { role?: string };
  if (!role || !VALID_ROLES.includes(role as (typeof VALID_ROLES)[number])) {
    return NextResponse.json({ error: "Role tidak valid" }, { status: 400 });
  }

  const target = await db.query.users.findFirst({ where: eq(users.id, id) });
  if (!target) return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });

  await db
    .update(users)
    .set({ role: role as (typeof VALID_ROLES)[number], updatedAt: new Date() })
    .where(eq(users.id, id));

  return NextResponse.json({ ok: true });
}
