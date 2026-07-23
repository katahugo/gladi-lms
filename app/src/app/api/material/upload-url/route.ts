import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { lessons, modules, courses } from "@/db/schema";
import { requireInstructor } from "@/lib/guards";
import { buildKey, ensureBucket, isS3Configured, presignUpload } from "@/lib/storage";

/**
 * POST /api/material/upload-url — minta signed URL untuk upload materi (PDF/gambar).
 * Body: { lessonId: string, filename: string, contentType: string }
 *
 * Hanya instruktur pemilik kursus (atau admin). Mengembalikan uploadUrl (PUT)
 * dan object key yang nantinya disimpan sebagai referensi materi.
 */
export async function POST(req: Request) {
  const user = await requireInstructor();
  if (!isS3Configured()) {
    return NextResponse.json({ error: "MinIO/S3 belum dikonfigurasi (env S3_* belum diisi)" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body bukan JSON valid" }, { status: 400 });
  }
  const { lessonId, filename, contentType } = (body ?? {}) as Record<string, unknown>;
  if (
    typeof lessonId !== "string" ||
    typeof filename !== "string" || !filename.trim() ||
    typeof contentType !== "string" || !contentType.trim()
  ) {
    return NextResponse.json({ error: "lessonId, filename, dan contentType wajib diisi" }, { status: 400 });
  }

  // Batasi tipe materi yang diizinkan (dokumen & gambar, bukan video — video ke Stream)
  const allowed = [
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/webp",
    "application/zip",
    "text/plain",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ];
  if (!allowed.includes(contentType)) {
    return NextResponse.json(
      { error: `Tipe file tidak diizinkan: ${contentType}. Gunakan PDF/gambar/dokumen.` },
      { status: 400 },
    );
  }

  // Verifikasi kepemilikan: lesson → module → course → instructorId
  const lesson = await db.query.lessons.findFirst({ where: eq(lessons.id, lessonId) });
  if (!lesson) return NextResponse.json({ error: "Lesson tidak ditemukan" }, { status: 404 });
  const mod = await db.query.modules.findFirst({ where: eq(modules.id, lesson.moduleId) });
  if (!mod) return NextResponse.json({ error: "Module tidak ditemukan" }, { status: 404 });
  const course = await db.query.courses.findFirst({ where: eq(courses.id, mod.courseId) });
  if (!course) return NextResponse.json({ error: "Kursus tidak ditemukan" }, { status: 404 });
  if (user.role !== "admin" && course.instructorId !== user.id) {
    return NextResponse.json({ error: "Anda bukan pemilik kursus ini" }, { status: 403 });
  }

  try {
    await ensureBucket();
    const key = buildKey("material", lessonId, filename.trim());
    const uploadUrl = await presignUpload(key, contentType);
    return NextResponse.json({ uploadUrl, key }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Gagal membuat upload URL";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
