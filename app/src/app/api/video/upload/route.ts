import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { lessons, modules, courses } from "@/db/schema";
import { getVideoProvider, isVideoConfigured } from "@/lib/video";
import { requireInstructor } from "@/lib/guards";

/**
 * POST /api/video/upload — minta URL direct-upload Cloudflare Stream.
 * Body: { lessonId: string, name: string }
 *
 * Hanya instruktur pemilik kursus (atau admin) yang boleh. Mengembalikan
 * uploadUrl (TUS endpoint) untuk di-upload langsung dari browser, dan
 * menyimpan video UID ke lessons.contentRef setelah upload dikonfirmasi
 * (lihat /api/video/confirm).
 */
export async function POST(req: Request) {
  const user = await requireInstructor();
  if (!isVideoConfigured()) {
    return NextResponse.json(
      { error: "Cloudflare Stream belum dikonfigurasi (env CF_STREAM_* belum diisi)" },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body bukan JSON valid" }, { status: 400 });
  }
  const { lessonId, name } = (body ?? {}) as Record<string, unknown>;
  if (typeof lessonId !== "string" || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "lessonId dan name wajib diisi" }, { status: 400 });
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
    const provider = getVideoProvider();
    const result = await provider.createDirectUpload({ name: name.trim() });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Gagal membuat direct upload";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
