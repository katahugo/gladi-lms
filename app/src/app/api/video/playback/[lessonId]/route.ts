import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { auth } from "@/auth";
import { db } from "@/db";
import { lessons, modules, courses, enrollments } from "@/db/schema";
import { getVideoProvider, isVideoConfigured } from "@/lib/video";

/**
 * GET /api/video/playback/[lessonId] — info playback untuk sebuah lesson video.
 *
 * Kontrol akses (PRD: proteksi konten berbayar):
 *   - lesson.isFreePreview = true  → boleh diakses siapa pun (termasuk anonim)
 *   - instruktur pemilik / admin   → boleh
 *   - siswa dengan enrollment aktif → boleh
 *   - selain itu                   → 403
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ lessonId: string }> },
) {
  const { lessonId } = await params;
  if (!isVideoConfigured()) {
    return NextResponse.json({ error: "Cloudflare Stream belum dikonfigurasi" }, { status: 503 });
  }

  const lesson = await db.query.lessons.findFirst({ where: eq(lessons.id, lessonId) });
  if (!lesson || lesson.type !== "video" || !lesson.contentRef?.startsWith("cf:")) {
    return NextResponse.json({ error: "Lesson video tidak ditemukan" }, { status: 404 });
  }
  const videoId = lesson.contentRef.slice(3);

  // Baca modul & kursus untuk cek kepemilikan
  const mod = await db.query.modules.findFirst({ where: eq(modules.id, lesson.moduleId) });
  if (!mod) return NextResponse.json({ error: "Module tidak ditemukan" }, { status: 404 });
  const course = await db.query.courses.findFirst({ where: eq(courses.id, mod.courseId) });
  if (!course) return NextResponse.json({ error: "Kursus tidak ditemukan" }, { status: 404 });

  // Kontrol akses
  let allowed = lesson.isFreePreview;
  if (!allowed) {
    const session = await auth();
    if (session?.user) {
      if (session.user.role === "admin" || course.instructorId === session.user.id) {
        allowed = true;
      } else {
        const enrollment = await db.query.enrollments.findFirst({
          where: and(
            eq(enrollments.userId, session.user.id),
            eq(enrollments.courseId, course.id),
            eq(enrollments.status, "active"),
          ),
        });
        allowed = Boolean(enrollment);
      }
    }
  }

  if (!allowed) {
    return NextResponse.json(
      { error: "Anda tidak punya akses ke video ini" },
      { status: 403 },
    );
  }

  try {
    const provider = getVideoProvider();
    const [playback, status] = await Promise.all([
      provider.getPlayback(videoId),
      provider.getStatus(videoId),
    ]);
    return NextResponse.json({ ...playback, status, durationSeconds: lesson.durationSeconds });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Gagal mengambil info playback";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
