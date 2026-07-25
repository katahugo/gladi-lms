import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { courses, lessons, modules } from "@/db/schema";
import { requireApiInstructor } from "@/lib/guards";
import {
  buildKey,
  ensureBucket,
  inferContentType,
  isS3Configured,
  putObject,
} from "@/lib/storage";

export const runtime = "nodejs";

const ALLOWED = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/zip",
  "text/plain",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

const MAX_BYTES = 50 * 1024 * 1024; // 50 MB

/**
 * POST /api/material/upload — proxy upload materi via app (bukan signed URL ke MinIO).
 *
 * Browser tidak bisa menjangkau `http://minio:9000` (internal Docker).
 * Multipart: lessonId + file → simpan ke MinIO → update lessons.contentRef.
 */
export async function POST(req: Request) {
  const authz = await requireApiInstructor();
  if (!authz.ok) return authz.response;

  if (!isS3Configured()) {
    return NextResponse.json(
      { error: "MinIO/S3 belum dikonfigurasi (env S3_* belum diisi)" },
      { status: 503 },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Body multipart tidak valid" }, { status: 400 });
  }

  const lessonId = String(form.get("lessonId") ?? "");
  const file = form.get("file");
  if (!lessonId || !(file instanceof File)) {
    return NextResponse.json({ error: "lessonId dan file wajib diisi" }, { status: 400 });
  }
  if (file.size <= 0) {
    return NextResponse.json({ error: "File kosong" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Ukuran file maksimal 50 MB" }, { status: 413 });
  }

  const contentType = (file.type && file.type.trim()) || inferContentType(file.name);
  if (!ALLOWED.has(contentType)) {
    return NextResponse.json(
      { error: `Tipe file tidak diizinkan: ${contentType || "(kosong)"}. Gunakan PDF/gambar/dokumen.` },
      { status: 400 },
    );
  }

  const lesson = await db.query.lessons.findFirst({ where: eq(lessons.id, lessonId) });
  if (!lesson) return NextResponse.json({ error: "Lesson tidak ditemukan" }, { status: 404 });
  const mod = await db.query.modules.findFirst({ where: eq(modules.id, lesson.moduleId) });
  if (!mod) return NextResponse.json({ error: "Module tidak ditemukan" }, { status: 404 });
  const course = await db.query.courses.findFirst({ where: eq(courses.id, mod.courseId) });
  if (!course) return NextResponse.json({ error: "Kursus tidak ditemukan" }, { status: 404 });
  if (authz.user.role !== "admin" && course.instructorId !== authz.user.id) {
    return NextResponse.json({ error: "Anda bukan pemilik kursus ini" }, { status: 403 });
  }

  try {
    await ensureBucket();
    const key = buildKey("material", lessonId, file.name);
    const bytes = Buffer.from(await file.arrayBuffer());
    await putObject(key, bytes, contentType);

    const contentRef = `s3:${key}`;
    await db.update(lessons).set({ contentRef }).where(eq(lessons.id, lessonId));

    return NextResponse.json({ ok: true, key, contentRef }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Gagal meng-upload materi";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
