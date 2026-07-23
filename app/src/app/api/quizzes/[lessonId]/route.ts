import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";

import { auth } from "@/auth";
import { db } from "@/db";
import {
  courses,
  enrollments,
  lessons,
  modules,
  quizAttempts,
  quizQuestions,
  quizzes,
} from "@/db/schema";

/**
 * GET /api/quizzes/[lessonId] — ambil kuis untuk sebuah lesson.
 *
 * Mengembalikan definisi kuis + daftar soal (TANPA correctAnswer agar tidak
 * bocor ke browser). Attempt siswa juga dikembalikan bila sudah pernah
 * mengerjakan, sehingga UI bisa menampilkan skor sebelumnya.
 *
 * Akses: lesson.isFreePreview (anonim) atau enrolled/instruktur/admin.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ lessonId: string }> },
) {
  const { lessonId } = await params;

  const lesson = await db.query.lessons.findFirst({ where: eq(lessons.id, lessonId) });
  if (!lesson || lesson.type !== "quiz") {
    return NextResponse.json({ error: "Kuis tidak ditemukan" }, { status: 404 });
  }
  const mod = await db.query.modules.findFirst({ where: eq(modules.id, lesson.moduleId) });
  if (!mod) return NextResponse.json({ error: "Module tidak ditemukan" }, { status: 404 });
  const course = await db.query.courses.findFirst({ where: eq(courses.id, mod.courseId) });
  if (!course) return NextResponse.json({ error: "Kursus tidak ditemukan" }, { status: 404 });

  const session = await auth();

  // Kontrol akses (sama seperti video/materi)
  let allowed = lesson.isFreePreview;
  let isOwnerOrAdmin = false;
  if (!allowed && session?.user) {
    if (session.user.role === "admin" || course.instructorId === session.user.id) {
      allowed = true;
      isOwnerOrAdmin = true;
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
  } else if (allowed && session?.user) {
    isOwnerOrAdmin =
      session.user.role === "admin" || course.instructorId === session.user.id;
  }
  if (!allowed) {
    return NextResponse.json({ error: "Anda tidak punya akses ke kuis ini" }, { status: 403 });
  }

  const quiz = await db.query.quizzes.findFirst({ where: eq(quizzes.lessonId, lessonId) });
  if (!quiz) {
    return NextResponse.json({ error: "Kuis belum dibuat instruktur" }, { status: 404 });
  }

  const qs = await db
    .select()
    .from(quizQuestions)
    .where(eq(quizQuestions.quizId, quiz.id))
    .orderBy(asc(quizQuestions.sortOrder));

  // Attempt user yang sedang login (bila ada)
  let attempts: Array<Awaited<ReturnType<typeof db.query.quizAttempts.findFirst>>> = [];
  if (session?.user) {
    const rows = await db
      .select()
      .from(quizAttempts)
      .where(and(eq(quizAttempts.quizId, quiz.id), eq(quizAttempts.userId, session.user.id)))
      .orderBy(asc(quizAttempts.attemptNumber));
    attempts = rows;
  }

  return NextResponse.json({
    quiz: {
      id: quiz.id,
      lessonId: quiz.lessonId,
      passingScore: quiz.passingScore,
      maxAttempts: quiz.maxAttempts,
    },
    // Sembunyikan correctAnswer dari respons publik (bocor jawaban).
    // Instruktur/admin melihat correctAnswer untuk review.
    questions: qs.map((q) => ({
      id: q.id,
      question: q.question,
      type: q.type,
      options: q.options ? JSON.parse(q.options) : null,
      points: q.points,
      sortOrder: q.sortOrder,
      ...(isOwnerOrAdmin ? { correctAnswer: q.correctAnswer } : {}),
    })),
    attempts: attempts.map((a) => ({
      id: a!.id,
      attemptNumber: a!.attemptNumber,
      score: a!.score,
      passed: a!.passed,
      status: a!.status,
      submittedAt: a!.submittedAt,
    })),
    // Jumlah attempt yang tersisa untuk siswa
    attemptsRemaining: Math.max(0, quiz.maxAttempts - attempts.length),
  });
}
