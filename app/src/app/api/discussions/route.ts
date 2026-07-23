import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";

import { auth } from "@/auth";
import { db } from "@/db";
import {
  courses,
  discussions,
  enrollments,
  lessons,
  modules,
  users,
} from "@/db/schema";

/**
 * GET /api/discussions?lessonId=... — daftar diskusi (thread + balasan) sebuah lesson.
 * Publik: siapa saja bisa MEMBACA thread. Menulis (POST) butuh login + enrollment
 * atau instruktur/admin.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const lessonId = url.searchParams.get("lessonId");
  if (!lessonId) {
    return NextResponse.json({ error: "lessonId wajib" }, { status: 400 });
  }

  const rows = await db
    .select({
      id: discussions.id,
      parentId: discussions.parentId,
      body: discussions.body,
      isResolved: discussions.isResolved,
      createdAt: discussions.createdAt,
      userId: discussions.userId,
      userName: users.name,
      userRole: users.role,
    })
    .from(discussions)
    .leftJoin(users, eq(discussions.userId, users.id))
    .where(eq(discussions.lessonId, lessonId))
    .orderBy(asc(discussions.createdAt));

  return NextResponse.json({ discussions: rows });
}

/**
 * POST /api/discussions — buat thread baru atau balasan.
 * Body: { lessonId: string, body: string, parentId?: string | null }
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
  const { lessonId, body, parentId } = (payload ?? {}) as Record<string, unknown>;
  if (typeof lessonId !== "string" || typeof body !== "string" || body.trim().length < 2) {
    return NextResponse.json({ error: "lessonId dan body (min 2 karakter) wajib diisi" }, { status: 400 });
  }
  if (parentId !== undefined && parentId !== null && typeof parentId !== "string") {
    return NextResponse.json({ error: "parentId tidak valid" }, { status: 400 });
  }

  const lesson = await db.query.lessons.findFirst({ where: eq(lessons.id, lessonId) });
  if (!lesson) return NextResponse.json({ error: "Lesson tidak ditemukan" }, { status: 404 });
  const mod = await db.query.modules.findFirst({ where: eq(modules.id, lesson.moduleId) });
  if (!mod) return NextResponse.json({ error: "Module tidak ditemukan" }, { status: 404 });
  const course = await db.query.courses.findFirst({ where: eq(courses.id, mod.courseId) });
  if (!course) return NextResponse.json({ error: "Kursus tidak ditemukan" }, { status: 404 });

  // Instruktur pemilik / admin / support boleh selalu; siswa butuh enrollment aktif
  const role = session.user.role;
  let allowed =
    role === "admin" ||
    role === "support" ||
    course.instructorId === session.user.id;
  if (!allowed) {
    const enrollment = await db.query.enrollments.findFirst({
      where: and(
        eq(enrollments.userId, session.user.id),
        eq(enrollments.courseId, course.id),
        eq(enrollments.status, "active"),
      ),
    });
    allowed = Boolean(enrollment);
  }
  if (!allowed) {
    return NextResponse.json({ error: "Anda tidak punya akses ke diskusi ini" }, { status: 403 });
  }

  // Validasi parent (bila balasan): parent harus ada di lesson yang sama
  let validatedParent: string | null = null;
  if (parentId) {
    const parent = await db.query.discussions.findFirst({
      where: and(eq(discussions.id, parentId as string), eq(discussions.lessonId, lessonId)),
    });
    if (!parent) return NextResponse.json({ error: "Parent tidak ditemukan" }, { status: 400 });
    // Batasi kedalaman: balasan hanya boleh ke thread akar (parentId=null)
    if (parent.parentId !== null) {
      return NextResponse.json({ error: "Balasan hanya boleh ke thread akar" }, { status: 400 });
    }
    validatedParent = parent.id;
  }

  const [created] = await db
    .insert(discussions)
    .values({
      lessonId,
      userId: session.user.id,
      parentId: validatedParent,
      body: body.trim(),
    })
    .returning();

  return NextResponse.json({ id: created.id }, { status: 201 });
}
