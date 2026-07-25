import { NextResponse } from "next/server";
import { asc, eq, inArray, max } from "drizzle-orm";

import { db } from "@/db";
import { lessons, modules } from "@/db/schema";
import { requireInstructor } from "@/lib/guards";
import { getOwnedCourse } from "@/lib/instructor-access";

/**
 * GET  — daftar modul + lesson untuk course builder.
 * POST — buat modul baru di akhir urutan.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireInstructor();
  const { id: courseId } = await params;

  const course = await getOwnedCourse(courseId, user);
  if (!course) {
    return NextResponse.json({ error: "Kursus tidak ditemukan atau akses ditolak" }, { status: 404 });
  }

  const mods = await db
    .select()
    .from(modules)
    .where(eq(modules.courseId, courseId))
    .orderBy(asc(modules.sortOrder));

  const moduleIds = mods.map((m) => m.id);
  const lessonsByModule =
    moduleIds.length === 0
      ? []
      : await db
          .select()
          .from(lessons)
          .where(inArray(lessons.moduleId, moduleIds))
          .orderBy(asc(lessons.sortOrder));

  const grouped = mods.map((m) => ({
    ...m,
    lessons: lessonsByModule.filter((l) => l.moduleId === m.id),
  }));

  return NextResponse.json({ course, modules: grouped });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireInstructor();
  const { id: courseId } = await params;

  const course = await getOwnedCourse(courseId, user);
  if (!course) {
    return NextResponse.json({ error: "Kursus tidak ditemukan atau akses ditolak" }, { status: 404 });
  }

  let body: { title?: string } = {};
  try {
    body = (await req.json()) as { title?: string };
  } catch {
    return NextResponse.json({ error: "Body bukan JSON valid" }, { status: 400 });
  }

  const title = String(body.title ?? "").trim();
  if (title.length < 2) {
    return NextResponse.json({ error: "Judul modul minimal 2 karakter" }, { status: 400 });
  }

  const [agg] = await db
    .select({ m: max(modules.sortOrder) })
    .from(modules)
    .where(eq(modules.courseId, courseId));
  const nextOrder = (agg?.m ?? -1) + 1;

  const [created] = await db
    .insert(modules)
    .values({ courseId, title, sortOrder: nextOrder })
    .returning();

  return NextResponse.json({ module: created }, { status: 201 });
}
