import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { modules } from "@/db/schema";
import { requireApiInstructor } from "@/lib/guards";
import { getOwnedModuleContext } from "@/lib/instructor-access";

/**
 * PATCH  — update judul modul / pindah urutan (direction: up|down).
 * DELETE — hapus modul (cascade lesson).
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ moduleId: string }> },
) {
  const authz = await requireApiInstructor();
  if (!authz.ok) return authz.response;
  const user = authz.user;
  const { moduleId } = await params;

  const ctx = await getOwnedModuleContext(moduleId, user);
  if (!ctx) {
    return NextResponse.json({ error: "Modul tidak ditemukan atau akses ditolak" }, { status: 404 });
  }

  let body: { title?: string; direction?: "up" | "down" } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Body bukan JSON valid" }, { status: 400 });
  }

  if (body.title !== undefined) {
    const title = String(body.title).trim();
    if (title.length < 2) {
      return NextResponse.json({ error: "Judul modul minimal 2 karakter" }, { status: 400 });
    }
    const [updated] = await db
      .update(modules)
      .set({ title })
      .where(eq(modules.id, moduleId))
      .returning();
    return NextResponse.json({ module: updated });
  }

  if (body.direction === "up" || body.direction === "down") {
    const siblings = await db
      .select()
      .from(modules)
      .where(eq(modules.courseId, ctx.module.courseId))
      .orderBy(asc(modules.sortOrder));

    const idx = siblings.findIndex((m) => m.id === moduleId);
    if (idx < 0) {
      return NextResponse.json({ error: "Modul tidak ditemukan" }, { status: 404 });
    }
    const swapIdx = body.direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= siblings.length) {
      return NextResponse.json({ module: ctx.module });
    }

    const current = siblings[idx];
    const neighbor = siblings[swapIdx];

    await db.transaction(async (trx) => {
      // Hindari bentrok unique (course_id, sort_order)
      await trx
        .update(modules)
        .set({ sortOrder: -1 - current.sortOrder })
        .where(eq(modules.id, current.id));
      await trx
        .update(modules)
        .set({ sortOrder: current.sortOrder })
        .where(eq(modules.id, neighbor.id));
      await trx
        .update(modules)
        .set({ sortOrder: neighbor.sortOrder })
        .where(eq(modules.id, current.id));
    });

    const [updated] = await db.select().from(modules).where(eq(modules.id, moduleId));
    return NextResponse.json({ module: updated });
  }

  return NextResponse.json({ error: "Tidak ada field yang diubah" }, { status: 400 });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ moduleId: string }> },
) {
  const authz = await requireApiInstructor();
  if (!authz.ok) return authz.response;
  const user = authz.user;
  const { moduleId } = await params;

  const ctx = await getOwnedModuleContext(moduleId, user);
  if (!ctx) {
    return NextResponse.json({ error: "Modul tidak ditemukan atau akses ditolak" }, { status: 404 });
  }

  await db.delete(modules).where(eq(modules.id, moduleId));

  // Rapikan sort_order agar tetap padat 0..n-1
  const remaining = await db
    .select()
    .from(modules)
    .where(eq(modules.courseId, ctx.module.courseId))
    .orderBy(asc(modules.sortOrder));

  await db.transaction(async (trx) => {
    for (let i = 0; i < remaining.length; i++) {
      await trx
        .update(modules)
        .set({ sortOrder: -1000 - i })
        .where(eq(modules.id, remaining[i].id));
    }
    for (let i = 0; i < remaining.length; i++) {
      await trx.update(modules).set({ sortOrder: i }).where(eq(modules.id, remaining[i].id));
    }
  });

  return NextResponse.json({ ok: true });
}
