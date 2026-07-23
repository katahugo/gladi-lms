import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";

import { auth } from "@/auth";
import { db } from "@/db";
import { enrollments, lessons, modules, progress } from "@/db/schema";

/**
 * GET /api/progress/[courseId] — ringkasan progress siswa pada sebuah kursus.
 *
 * Mengembalikan daftar lesson beserta status progress siswa, untuk merender
 * halaman belajar (C5) dengan penanda selesai/posisi terakhir.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ courseId: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Silakan login terlebih dahulu" }, { status: 401 });
  }
  const { courseId } = await params;

  const enrollment = await db.query.enrollments.findFirst({
    where: and(
      eq(enrollments.userId, session.user.id),
      eq(enrollments.courseId, courseId),
      eq(enrollments.status, "active"),
    ),
  });
  if (!enrollment) {
    return NextResponse.json({ error: "Anda belum terdaftar di kursus ini" }, { status: 403 });
  }

  const mods = await db
    .select()
    .from(modules)
    .where(eq(modules.courseId, courseId))
    .orderBy(asc(modules.sortOrder));

  const modIds = mods.map((m) => m.id);
  const allLessons = modIds.length
    ? await db.select().from(lessons).orderBy(asc(lessons.sortOrder))
    : [];

  const userProgress = await db
    .select()
    .from(progress)
    .where(eq(progress.userId, session.user.id));

  const progressMap = new Map(userProgress.map((p) => [p.lessonId, p]));

  const totalLessons = allLessons.length;
  const completedLessons = allLessons.filter((l) => progressMap.get(l.id)?.completedAt).length;
  const percentCourse = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  return NextResponse.json({
    enrollment: { status: enrollment.status, enrolledAt: enrollment.enrolledAt },
    totalLessons,
    completedLessons,
    percentCourse,
    modules: mods.map((m) => ({
      id: m.id,
      title: m.title,
      sortOrder: m.sortOrder,
      lessons: allLessons
        .filter((l) => l.moduleId === m.id)
        .map((l) => {
          const p = progressMap.get(l.id);
          return {
            id: l.id,
            title: l.title,
            type: l.type,
            isFreePreview: l.isFreePreview,
            percentComplete: p?.percentComplete ?? 0,
            lastPositionSeconds: p?.lastPositionSeconds ?? 0,
            completed: Boolean(p?.completedAt),
          };
        }),
    })),
  });
}
