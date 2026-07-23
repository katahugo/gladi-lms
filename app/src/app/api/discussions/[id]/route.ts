import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { auth } from "@/auth";
import { db } from "@/db";
import { courses, discussions, lessons, modules } from "@/db/schema";

/**
 * DELETE /api/discussions/[id] — hapus komentar milik sendiri, atau oleh
 * instruktur pemilik kursus, admin, atau support (moderasi).
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Silakan login" }, { status: 401 });
  }
  const { id } = await params;

  const item = await db.query.discussions.findFirst({ where: eq(discussions.id, id) });
  if (!item) return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });

  let canDelete = item.userId === session.user.id;
  if (!canDelete && (session.user.role === "admin" || session.user.role === "support")) {
    canDelete = true;
  }
  if (!canDelete) {
    // Cek instruktur pemilik kursus terkait
    const lesson = await db.query.lessons.findFirst({ where: eq(lessons.id, item.lessonId) });
    if (lesson) {
      const mod = await db.query.modules.findFirst({ where: eq(modules.id, lesson.moduleId) });
      if (mod) {
        const course = await db.query.courses.findFirst({ where: eq(courses.id, mod.courseId) });
        if (course && course.instructorId === session.user.id) canDelete = true;
      }
    }
  }
  if (!canDelete) {
    return NextResponse.json({ error: "Anda tidak boleh menghapus komentar ini" }, { status: 403 });
  }

  await db.delete(discussions).where(eq(discussions.id, id));
  return NextResponse.json({ ok: true });
}

/**
 * PATCH /api/discussions/[id] — tandai/urungkan resolved. Hanya instruktur
 * pemilik / admin / support / pembuat thread yang boleh.
 * Body: { isResolved: boolean }
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Silakan login" }, { status: 401 });
  }
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body bukan JSON valid" }, { status: 400 });
  }
  const { isResolved } = (body ?? {}) as { isResolved?: boolean };
  if (typeof isResolved !== "boolean") {
    return NextResponse.json({ error: "isResolved wajib boolean" }, { status: 400 });
  }

  const item = await db.query.discussions.findFirst({ where: eq(discussions.id, id) });
  if (!item) return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });
  if (item.parentId !== null) {
    return NextResponse.json({ error: "Hanya thread akar yang bisa ditandai resolved" }, { status: 400 });
  }

  let canEdit = item.userId === session.user.id;
  if (!canEdit && (session.user.role === "admin" || session.user.role === "support")) {
    canEdit = true;
  }
  if (!canEdit) {
    const lesson = await db.query.lessons.findFirst({ where: eq(lessons.id, item.lessonId) });
    if (lesson) {
      const mod = await db.query.modules.findFirst({ where: eq(modules.id, lesson.moduleId) });
      if (mod) {
        const course = await db.query.courses.findFirst({ where: eq(courses.id, mod.courseId) });
        if (course && course.instructorId === session.user.id) canEdit = true;
      }
    }
  }
  if (!canEdit) {
    return NextResponse.json({ error: "Anda tidak boleh mengubah komentar ini" }, { status: 403 });
  }

  await db
    .update(discussions)
    .set({ isResolved, updatedAt: new Date() })
    .where(eq(discussions.id, id));

  return NextResponse.json({ ok: true });
}
