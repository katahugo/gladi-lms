import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { auth } from "@/auth";
import { db } from "@/db";
import { progress, lessons, modules, enrollments } from "@/db/schema";

/**
 * POST /api/progress — catat progress siswa pada sebuah lesson.
 * Body: { lessonId: string, percentComplete?: number, lastPositionSeconds?: number, completed?: boolean }
 *
 * Hanya siswa dengan enrollment aktif pada kursus terkait. Upsert berdasarkan
 * (userId, lessonId) — progress bersifat idempoten.
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
  const { lessonId, percentComplete, lastPositionSeconds, completed } = (body ?? {}) as Record<string, unknown>;
  if (typeof lessonId !== "string") {
    return NextResponse.json({ error: "lessonId wajib diisi" }, { status: 400 });
  }

  const lesson = await db.query.lessons.findFirst({ where: eq(lessons.id, lessonId) });
  if (!lesson) return NextResponse.json({ error: "Lesson tidak ditemukan" }, { status: 404 });
  const mod = await db.query.modules.findFirst({ where: eq(modules.id, lesson.moduleId) });
  if (!mod) return NextResponse.json({ error: "Module tidak ditemukan" }, { status: 404 });

  // Wajib enrollment aktif
  const enrollment = await db.query.enrollments.findFirst({
    where: and(
      eq(enrollments.userId, session.user.id),
      eq(enrollments.courseId, mod.courseId),
      eq(enrollments.status, "active"),
    ),
  });
  if (!enrollment) {
    return NextResponse.json({ error: "Anda belum terdaftar di kursus ini" }, { status: 403 });
  }

  const pct = typeof percentComplete === "number" ? Math.max(0, Math.min(100, Math.round(percentComplete))) : undefined;
  const pos = typeof lastPositionSeconds === "number" ? Math.max(0, Math.round(lastPositionSeconds)) : undefined;
  const isCompleted = completed === true || pct === 100;

  await db
    .insert(progress)
    .values({
      userId: session.user.id,
      lessonId,
      percentComplete: pct ?? (isCompleted ? 100 : 0),
      lastPositionSeconds: pos ?? 0,
      completedAt: isCompleted ? new Date() : null,
    })
    .onConflictDoUpdate({
      target: [progress.userId, progress.lessonId],
      set: {
        ...(pct !== undefined ? { percentComplete: pct } : {}),
        ...(pos !== undefined ? { lastPositionSeconds: pos } : {}),
        ...(isCompleted ? { completedAt: new Date() } : {}),
        updatedAt: new Date(),
      },
    });

  return NextResponse.json({ ok: true });
}
