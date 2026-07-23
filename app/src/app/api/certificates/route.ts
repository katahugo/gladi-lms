import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";

import { auth } from "@/auth";
import { db } from "@/db";
import {
  certificates,
  courses,
  enrollments,
  lessons,
  modules,
  progress,
  users,
} from "@/db/schema";
import { generateCertificateNumber } from "@/lib/quiz";

// Import queue secara lazy (hanya di sisi server, tidak di edge)
async function getQueue() {
  const { queue } = await import("@/worker");
  return queue;
}

/**
 * POST /api/certificates/issue — terbitkan sertifikat untuk siswa pada kursus.
 * Body: { courseId: string }
 *
 * Prasyarat: siswa telah menyelesaikan SEMUA lesson di kursus (progress
 * completedAt tidak null untuk setiap lesson). Idempoten: jika sertifikat
 * sudah ada, kembalikan yang lama (unique index certificates_user_course_unique).
 * Bila lulus, enrollment ditandai "completed".
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
  const { courseId } = (body ?? {}) as Record<string, unknown>;
  if (typeof courseId !== "string") {
    return NextResponse.json({ error: "courseId wajib diisi" }, { status: 400 });
  }

  const course = await db.query.courses.findFirst({ where: eq(courses.id, courseId) });
  if (!course) return NextResponse.json({ error: "Kursus tidak ditemukan" }, { status: 404 });

  // Wajib enrollment aktif atau completed
  const enrollment = await db.query.enrollments.findFirst({
    where: and(eq(enrollments.userId, session.user.id), eq(enrollments.courseId, courseId)),
  });
  if (!enrollment || (enrollment.status !== "active" && enrollment.status !== "completed")) {
    return NextResponse.json({ error: "Anda belum terdaftar di kursus ini" }, { status: 403 });
  }

  // Cek sudah pernah terbit?
  const existing = await db.query.certificates.findFirst({
    where: and(eq(certificates.userId, session.user.id), eq(certificates.courseId, courseId)),
  });
  if (existing) {
    return NextResponse.json({
      certificateNumber: existing.certificateNumber,
      issuedAt: existing.issuedAt,
      reused: true,
    });
  }

  // Verifikasi seluruh lesson selesai
  const mods = await db
    .select()
    .from(modules)
    .where(eq(modules.courseId, courseId))
    .orderBy(asc(modules.sortOrder));
  const modIds = mods.map((m) => m.id);
  const allLessons = modIds.length
    ? await db.select().from(lessons)
    : [];
  const courseLessons = allLessons.filter((l) => modIds.includes(l.moduleId));

  if (courseLessons.length === 0) {
    return NextResponse.json({ error: "Kursus belum memiliki materi" }, { status: 400 });
  }

  const userProgress = await db
    .select()
    .from(progress)
    .where(eq(progress.userId, session.user.id));
  const completedIds = new Set(
    userProgress.filter((p) => p.completedAt).map((p) => p.lessonId),
  );
  const allDone = courseLessons.every((l) => completedIds.has(l.id));

  if (!allDone) {
    const remaining = courseLessons.filter((l) => !completedIds.has(l.id)).length;
    return NextResponse.json(
      { error: `Selesaikan seluruh materi dulu. Tersisa ${remaining} materi.` },
      { status: 400 },
    );
  }

  const certificateNumber = generateCertificateNumber();

  await db.transaction(async (trx) => {
    await trx.insert(certificates).values({
      userId: session.user!.id,
      courseId,
      certificateNumber,
    });
    if (enrollment.status !== "completed") {
      await trx
        .update(enrollments)
        .set({ status: "completed", completedAt: new Date() })
        .where(eq(enrollments.id, enrollment.id));
    }
  });

  // Trigger job worker untuk generate PDF + kirim email (async, non-blocking)
  try {
    const q = await getQueue();
    const instructor = await db.query.users.findFirst({
      where: eq(users.id, course!.instructorId),
    });
    await q.add("certificate", {
      certificateNumber,
      holderName: session.user!.name ?? "Peserta",
      courseTitle: course!.title,
      instructorName: instructor?.name ?? "Instruktur",
      issuedDate: new Date().toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
      userEmail: session.user!.email ?? "",
    });
  } catch (err) {
    console.error("[certificates] Gagal queue job certificate:", err);
  }

  return NextResponse.json({ certificateNumber, issuedAt: new Date() }, { status: 201 });
}

/**
 * GET /api/certificates — daftar sertifikat milik user yang login.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Silakan login terlebih dahulu" }, { status: 401 });
  }

  const rows = await db
    .select({
      id: certificates.id,
      certificateNumber: certificates.certificateNumber,
      issuedAt: certificates.issuedAt,
      courseId: certificates.courseId,
      courseTitle: courses.title,
      courseSlug: courses.slug,
    })
    .from(certificates)
    .leftJoin(courses, eq(certificates.courseId, courses.id))
    .where(eq(certificates.userId, session.user.id));

  return NextResponse.json({ certificates: rows });
}
