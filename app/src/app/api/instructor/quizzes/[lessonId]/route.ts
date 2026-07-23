import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { courses, lessons, modules, quizQuestions, quizzes } from "@/db/schema";
import { requireInstructor } from "@/lib/guards";

/**
 * POST /api/instructor/quizzes/[lessonId] — buat atau ganti kuis pada lesson.
 * Body: {
 *   passingScore?: number,
 *   maxAttempts?: number,
 *   questions: Array<{
 *     question: string,
 *     type: "multiple_choice" | "true_false" | "essay",
 *     options?: Array<{id: string, text: string}>,
 *     correctAnswer?: string | null,
 *     points?: number
 *   }>
 * }
 *
 * Idempotent: jika kuis sudah ada, soal-soal lama diganti dengan yang baru.
 * Guard: instruktur pemilik kursus (atau admin).
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ lessonId: string }> },
) {
  const user = await requireInstructor();
  const { lessonId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body bukan JSON valid" }, { status: 400 });
  }
  const { passingScore, maxAttempts, questions } = (body ?? {}) as {
    passingScore?: number;
    maxAttempts?: number;
    questions?: Array<{
      question?: string;
      type?: string;
      options?: Array<{ id: string; text: string }>;
      correctAnswer?: string | null;
      points?: number;
    }>;
  };

  if (!Array.isArray(questions) || questions.length === 0) {
    return NextResponse.json({ error: "Kuis harus memiliki minimal 1 soal" }, { status: 400 });
  }
  for (const q of questions) {
    if (!q.question || typeof q.question !== "string" || q.question.trim().length < 3) {
      return NextResponse.json({ error: "Setiap soal wajib punya pertanyaan minimal 3 karakter" }, { status: 400 });
    }
    if (!q.type || !["multiple_choice", "true_false", "essay"].includes(q.type)) {
      return NextResponse.json({ error: `Tipe soal tidak valid: ${q.type}` }, { status: 400 });
    }
    if (q.type === "multiple_choice") {
      if (!Array.isArray(q.options) || q.options.length < 2) {
        return NextResponse.json({ error: "Pilihan ganda butuh minimal 2 opsi" }, { status: 400 });
      }
      if (!q.correctAnswer || !q.options.some((o) => o.id === q.correctAnswer)) {
        return NextResponse.json({ error: "correctAnswer harus salah satu id opsi" }, { status: 400 });
      }
    } else if (q.type === "true_false") {
      if (!["true", "false"].includes(String(q.correctAnswer ?? "").toLowerCase())) {
        return NextResponse.json({ error: "true_false harus punya correctAnswer 'true'/'false'" }, { status: 400 });
      }
    }
  }

  // Verifikasi kepemilikan
  const lesson = await db.query.lessons.findFirst({ where: eq(lessons.id, lessonId) });
  if (!lesson) return NextResponse.json({ error: "Lesson tidak ditemukan" }, { status: 404 });
  const mod = await db.query.modules.findFirst({ where: eq(modules.id, lesson.moduleId) });
  if (!mod) return NextResponse.json({ error: "Module tidak ditemukan" }, { status: 404 });
  const course = await db.query.courses.findFirst({ where: eq(courses.id, mod.courseId) });
  if (!course) return NextResponse.json({ error: "Kursus tidak ditemukan" }, { status: 404 });
  if (user.role !== "admin" && course.instructorId !== user.id) {
    return NextResponse.json({ error: "Anda bukan pemilik kursus ini" }, { status: 403 });
  }

  const passing = Math.max(0, Math.min(100, Math.round(Number(passingScore ?? 70))));
  const maxAtt = Math.max(1, Math.min(20, Math.round(Number(maxAttempts ?? 3))));

  await db.transaction(async (trx) => {
    // Pastikan lesson bertipe quiz
    await trx.update(lessons).set({ type: "quiz" }).where(eq(lessons.id, lessonId));

    // Upsert quiz row
    const existing = await trx.query.quizzes.findFirst({ where: eq(quizzes.lessonId, lessonId) });
    let quizId: string;
    if (existing) {
      quizId = existing.id;
      await trx
        .update(quizzes)
        .set({ passingScore: passing, maxAttempts: maxAtt })
        .where(eq(quizzes.id, quizId));
      // Hapus soal lama (cascade)
      await trx.delete(quizQuestions).where(eq(quizQuestions.quizId, quizId));
    } else {
      const [created] = await trx
        .insert(quizzes)
        .values({ lessonId, passingScore: passing, maxAttempts: maxAtt })
        .returning({ id: quizzes.id });
      quizId = created.id;
    }

    // Simpan soal-soal baru
    await trx.insert(quizQuestions).values(
      questions.map((q, i) => ({
        quizId,
        question: q.question!.trim(),
        type: q.type as "multiple_choice" | "true_false" | "essay",
        options: q.options ? JSON.stringify(q.options) : null,
        correctAnswer: q.type === "essay" ? null : q.correctAnswer ?? null,
        points: Math.max(1, Math.round(Number(q.points ?? 1))),
        sortOrder: i,
      })),
    );

    // Simpan quizId ke lesson.contentRef (agar mudah dirujuk)
    await trx
      .update(lessons)
      .set({ contentRef: `quiz:${quizId}` })
      .where(eq(lessons.id, lessonId));
  });

  return NextResponse.json({ ok: true });
}
