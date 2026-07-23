import { NextResponse } from "next/server";
import { and, avg, count, desc, eq } from "drizzle-orm";

import { auth } from "@/auth";
import { db } from "@/db";
import { courseReviews, courses, enrollments, users } from "@/db/schema";

/**
 * GET /api/reviews?courseId=... — daftar review + ringkasan rating kursus.
 * Publik (bisa dibaca siapa saja untuk halaman detail).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const courseId = url.searchParams.get("courseId");
  if (!courseId) return NextResponse.json({ error: "courseId wajib" }, { status: 400 });

  const [summaryRow] = await db
    .select({ avg: avg(courseReviews.rating), total: count(courseReviews.id) })
    .from(courseReviews)
    .where(eq(courseReviews.courseId, courseId));

  const rows = await db
    .select({
      id: courseReviews.id,
      rating: courseReviews.rating,
      review: courseReviews.review,
      createdAt: courseReviews.createdAt,
      userName: users.name,
    })
    .from(courseReviews)
    .leftJoin(users, eq(courseReviews.userId, users.id))
    .where(eq(courseReviews.courseId, courseId))
    .orderBy(desc(courseReviews.createdAt));

  return NextResponse.json({
    average: summaryRow?.avg ? Number(summaryRow.avg) : 0,
    total: Number(summaryRow?.total ?? 0),
    reviews: rows,
  });
}

/**
 * POST /api/reviews — kirim rating (idempoten: upsert per user+course).
 * Body: { courseId: string, rating: 1..5, review?: string }
 * Hanya siswa dengan enrollment aktif/completed yang boleh me-review.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Silakan login terlebih dahulu" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Body bukan JSON valid" }, { status: 400 });
  }
  const { courseId, rating, review } = (payload ?? {}) as Record<string, unknown>;
  if (typeof courseId !== "string") {
    return NextResponse.json({ error: "courseId wajib" }, { status: 400 });
  }
  const ratingNum = Number(rating);
  if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    return NextResponse.json({ error: "rating harus 1..5" }, { status: 400 });
  }

  // Wajib enrollment (aktif atau completed)
  const enrollment = await db.query.enrollments.findFirst({
    where: and(eq(enrollments.userId, session.user.id), eq(enrollments.courseId, courseId)),
  });
  if (!enrollment) {
    return NextResponse.json({ error: "Anda belum terdaftar di kursus ini" }, { status: 403 });
  }

  const course = await db.query.courses.findFirst({ where: eq(courses.id, courseId) });
  if (!course) return NextResponse.json({ error: "Kursus tidak ditemukan" }, { status: 404 });

  const reviewText = typeof review === "string" ? review.trim() : null;

  await db
    .insert(courseReviews)
    .values({
      userId: session.user.id,
      courseId,
      rating: ratingNum,
      review: reviewText || null,
    })
    .onConflictDoUpdate({
      target: [courseReviews.userId, courseReviews.courseId],
      set: { rating: ratingNum, review: reviewText || null },
    });

  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/reviews?courseId=... — hapus review milik user yang login.
 */
export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Silakan login" }, { status: 401 });
  }
  const url = new URL(req.url);
  const courseId = url.searchParams.get("courseId");
  if (!courseId) return NextResponse.json({ error: "courseId wajib" }, { status: 400 });

  await db
    .delete(courseReviews)
    .where(
      and(eq(courseReviews.userId, session.user.id), eq(courseReviews.courseId, courseId)),
    );
  return NextResponse.json({ ok: true });
}
