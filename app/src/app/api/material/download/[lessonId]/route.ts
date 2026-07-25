import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { auth } from "@/auth";
import { db } from "@/db";
import { courses, enrollments, lessons, modules } from "@/db/schema";
import { getObject, isS3Configured } from "@/lib/storage";

export const runtime = "nodejs";

/**
 * GET /api/material/download/[lessonId] — stream materi lewat app (proxy MinIO).
 *
 * Tidak memakai signed URL ke host internal `minio:9000` karena browser
 * tidak bisa menjangkaunya.
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
    const obj = await getObject(key);
    const body = obj.Body;
    if (!body) {
      return NextResponse.json({ error: "File kosong di storage" }, { status: 404 });
    }

    const filename = key.split("/").pop() ?? "materi";
    const stream = body.transformToWebStream();
    return new NextResponse(stream, {
      headers: {
        "Content-Type": obj.ContentType ?? "application/octet-stream",
        "Content-Disposition": `attachment; filename="${filename.replace(/"/g, "")}"`,
        ...(obj.ContentLength != null ? { "Content-Length": String(obj.ContentLength) } : {}),
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Gagal mengunduh materi";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
