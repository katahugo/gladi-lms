import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { lessons, modules, courses } from "@/db/schema";
import { getVideoProvider, isVideoConfigured } from "@/lib/video";
import { requireInstructor } from "@/lib/guards";

/**
 * POST /api/video/confirm — konfirmasi upload selesai, simpan video UID.
 * Body: { lessonId: string, videoId: string }
 *
 * Dipanggil oleh browser setelah upload TUS ke Cloudflare Stream berhasil.
 * Menyimpan UID ke lessons.contentRef (dengan prefix "cf:" agar jelas
 * penyedianya) dan mengubah tipe lesson menjadi video.
 */
export async function POST(req: Request) {
  const user = await requireInstructor();
  if (!isVideoConfigured()) {
    return NextResponse.json({ error: "Cloudflare Stream belum dikonfigurasi" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body bukan JSON valid" }, { status: 400 });
  }
  const { lessonId, videoId } = (body ?? {}) as Record<string, unknown>;
  if (typeof lessonId !== "string" || typeof videoId !== "string" || !videoId.trim()) {
    return NextResponse.json({ error: "lessonId dan videoId wajib diisi" }, { status: 400 });
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

  // Verifikasi video benar-benar ada di Cloudflare (atau sedang diproses)
  try {
    const provider = getVideoProvider();
    const status = await provider.getStatus(videoId.trim());
    if (status === "error") {
      return NextResponse.json({ error: "Video gagal diproses di Cloudflare" }, { status: 400 });
    }
  } catch {
    // Jika pengecekan status gagal (mis. UID tidak valid), tolak.
    return NextResponse.json({ error: "videoId tidak valid" }, { status: 400 });
  }

  await db
    .update(lessons)
    .set({ type: "video", contentRef: `cf:${videoId.trim()}` })
    .where(eq(lessons.id, lessonId));

  return NextResponse.json({ ok: true, contentRef: `cf:${videoId.trim()}` });
}
