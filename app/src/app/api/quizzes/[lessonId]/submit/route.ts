import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";

import { auth } from "@/auth";
import { db } from "@/db";
import {
  enrollments,
  lessons,
  modules,
  progress,
  quizAttempts,
  quizQuestions,
  quizzes,
} from "@/db/schema";
import { gradeAnswers } from "@/lib/quiz";

/**
 * POST /api/quizzes/[lessonId]/submit — siswa submit jawaban kuis.
 * Body: { answers: { [questionId]: string } }
 *
 * Alur:
 *   1. Wajib login + enrollment aktif.
 *   2. Cek batas maxAttempts.
 *   3. Auto-grade (MC + true/false); essay ditunda (score null → butuh review manual).
 *   4. Simpan attempt dengan attemptNumber berurutan.
 *   5. Bila lulus (score >= passingScore), tandai progress lesson kuis selesai.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ lessonId: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Silakan login terlebih dahulu" }, { status: 401 });
  }
  const { lessonId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body bukan JSON valid" }, { status: 400 });
  }
  const { answers } = (body ?? {}) as { answers?: Record<string, string> };
  if (!answers || typeof answers !== "object") {
    return NextResponse.json({ error: "answers wajib berupa objek" }, { status: 400 });
  }

  const lesson = await db.query.lessons.findFirst({ where: eq(lessons.id, lessonId) });
  if (!lesson || lesson.type !== "quiz") {
    return NextResponse.json({ error: "Kuis tidak ditemukan" }, { status: 404 });
  }
  const mod = await db.query.modules.findFirst({ where: eq(modules.id, lesson.moduleId) });
  if (!mod) return NextResponse.json({ error: "Module tidak ditemukan" }, { status: 404 });

  // Wajib enrollment aktif (instruktur/admin tidak submit kuis)
  const enrollment = await db.query.enrollments.findFirst({
    where: and(
      eq(enrollments.userId, session.user.id),
      eq(enrollments.courseId, mod.courseId),
      eq(enrollments.status, "active"),
    ),
  });
  if (!enrollment) {
    return NextResponse.json({ error: "Anda belum terdaftar di kursus ini" }, { status: 403 });
  }

  const quiz = await db.query.quizzes.findFirst({ where: eq(quizzes.lessonId, lessonId) });
  if (!quiz) return NextResponse.json({ error: "Kuis belum tersedia" }, { status: 404 });

  const priorAttempts = await db
    .select()
    .from(quizAttempts)
    .where(and(eq(quizAttempts.quizId, quiz.id), eq(quizAttempts.userId, session.user.id)))
    .orderBy(asc(quizAttempts.attemptNumber));

  if (priorAttempts.length >= quiz.maxAttempts) {
    return NextResponse.json(
      { error: `Batas percobaan (${quiz.maxAttempts}) sudah tercapai` },
      { status: 429 },
    );
  }

  const qs = await db
    .select()
    .from(quizQuestions)
    .where(eq(quizQuestions.quizId, quiz.id))
    .orderBy(asc(quizQuestions.sortOrder));

  const grading = gradeAnswers(qs, answers);
  const passed = grading.score !== null && grading.score >= quiz.passingScore;

  const [attempt] = await db
    .insert(quizAttempts)
    .values({
      quizId: quiz.id,
      userId: session.user.id,
      attemptNumber: priorAttempts.length + 1,
      answers: JSON.stringify(answers),
      score: grading.score,
      passed: grading.score === null ? null : passed,
      status: grading.fullyAutoGraded ? "graded" : "submitted",
      submittedAt: new Date(),
    })
    .returning();

  // Bila lulus → tandai progress lesson kuis selesai
  if (passed) {
    await db
      .insert(progress)
      .values({
        userId: session.user.id,
        lessonId,
        percentComplete: 100,
        lastPositionSeconds: 0,
        completedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [progress.userId, progress.lessonId],
        set: { percentComplete: 100, completedAt: new Date(), updatedAt: new Date() },
      });
  }

  return NextResponse.json({
    attemptId: attempt.id,
    attemptNumber: attempt.attemptNumber,
    score: grading.score,
    passed: grading.score === null ? null : passed,
    fullyAutoGraded: grading.fullyAutoGraded,
    earnedPoints: grading.earnedPoints,
    totalPoints: grading.totalPoints,
    passingScore: quiz.passingScore,
    attemptsRemaining: Math.max(0, quiz.maxAttempts - (priorAttempts.length + 1)),
  });
}
