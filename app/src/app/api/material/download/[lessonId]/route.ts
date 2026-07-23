import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { auth } from "@/auth";
import { db } from "@/db";
import { lessons, modules, courses, enrollments } from "@/db/schema";
import { isS3Configured, presignDownload } from "@/lib/storage";

/**
 * GET /api/material/download/[lessonId] — signed URL untuk mengunduh materi lesson.
 *
 * Kontrol akses (sama seperti video playback):
 *   - lesson.isFreePreview = true  → boleh siapa pun
 *   - instruktur pemilik / admin   → boleh
 *   - siswa dengan enrollment aktif → boleh
 *   - selain itu                   → 403
 *
 * Materi disimpan sebagai object key di lessons.contentRef (prefix "s3:").
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ lessonId: string }> },
) {
  const { lessonId } = await params;
  if (!isS3Configured()) {
    return NextResponse.json({ error: "MinIO/S3 belum dikonfigurasi" }, { status: 503 });
  }

  const lesson = await db.query.lessons.findFirst({ where: eq(lessons.id, lessonId) });
  if (!lesson || !lesson.contentRef?.startsWith("s3:")) {
    return NextResponse.json({ error: "Materi tidak ditemukan" }, { status: 404 });
  }
  const key = lesson.contentRef.slice(3);

  const mod = await db.query.modules.findFirst({ where: eq(modules.id, lesson.moduleId) });
  if (!mod) return NextResponse.json({ error: "Module tidak ditemukan" }, { status: 404 });
  const course = await db.query.courses.findFirst({ where: eq(courses.id, mod.courseId) });
  if (!course) return NextResponse.json({ error: "Kursus tidak ditemukan" }, { status: 404 });

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
    return NextResponse.json({ error: "Anda tidak punya akses ke materi ini" }, { status: 403 });
  }

  try {
    const downloadUrl = await presignDownload(key);
    return NextResponse.json({ downloadUrl, filename: key.split("/").pop() });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Gagal membuat download URL";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
