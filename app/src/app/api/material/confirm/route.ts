import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { lessons, modules, courses } from "@/db/schema";
import { requireInstructor } from "@/lib/guards";
import { isS3Configured } from "@/lib/storage";

/**
 * POST /api/material/confirm — simpan object key materi ke lesson setelah upload.
 * Body: { lessonId: string, key: string }
 *
 * Menyimpan key ke lessons.contentRef dengan prefix "s3:".
 */
export async function POST(req: Request) {
  const user = await requireInstructor();
  if (!isS3Configured()) {
    return NextResponse.json({ error: "MinIO/S3 belum dikonfigurasi" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body bukan JSON valid" }, { status: 400 });
  }
  const { lessonId, key } = (body ?? {}) as Record<string, unknown>;
  if (typeof lessonId !== "string" || typeof key !== "string" || !key.startsWith("material/")) {
    return NextResponse.json({ error: "lessonId dan key (material/...) wajib diisi" }, { status: 400 });
  }

  const lesson = await db.query.lessons.findFirst({ where: eq(lessons.id, lessonId) });
  if (!lesson) return NextResponse.json({ error: "Lesson tidak ditemukan" }, { status: 404 });
  const mod = await db.query.modules.findFirst({ where: eq(modules.id, lesson.moduleId) });
  if (!mod) return NextResponse.json({ error: "Module tidak ditemukan" }, { status: 404 });
  const course = await db.query.courses.findFirst({ where: eq(courses.id, mod.courseId) });
  if (!course) return NextResponse.json({ error: "Kursus tidak ditemukan" }, { status: 404 });
  if (user.role !== "admin" && course.instructorId !== user.id) {
    return NextResponse.json({ error: "Anda bukan pemilik kursus ini" }, { status: 403 });
  }

  await db
    .update(lessons)
    .set({ contentRef: `s3:${key}` })
    .where(eq(lessons.id, lessonId));

  return NextResponse.json({ ok: true, contentRef: `s3:${key}` });
}
