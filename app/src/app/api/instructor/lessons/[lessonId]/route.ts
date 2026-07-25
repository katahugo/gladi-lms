import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { lessons } from "@/db/schema";
import { requireInstructor } from "@/lib/guards";
import { getOwnedLessonContext } from "@/lib/instructor-access";

const LESSON_TYPES = ["video", "text", "quiz", "assignment"] as const;
type LessonType = (typeof LESSON_TYPES)[number];

/**
 * PATCH  — update metadata lesson / pindah urutan / konten teks.
 * DELETE — hapus lesson.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ lessonId: string }> },
) {
  const user = await requireInstructor();
  const { lessonId } = await params;

  const ctx = await getOwnedLessonContext(lessonId, user);
  if (!ctx) {
    return NextResponse.json({ error: "Materi tidak ditemukan atau akses ditolak" }, { status: 404 });
  }

  let body: {
    title?: string;
    type?: string;
    contentBody?: string | null;
    isFreePreview?: boolean;
    direction?: "up" | "down";
  } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Body bukan JSON valid" }, { status: 400 });
  }

  if (body.direction === "up" || body.direction === "down") {
    const siblings = await db
      .select()
      .from(lessons)
      .where(eq(lessons.moduleId, ctx.lesson.moduleId))
      .orderBy(asc(lessons.sortOrder));

    const idx = siblings.findIndex((l) => l.id === lessonId);
    if (idx < 0) {
      return NextResponse.json({ error: "Materi tidak ditemukan" }, { status: 404 });
    }
    const swapIdx = body.direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= siblings.length) {
      return NextResponse.json({ lesson: ctx.lesson });
    }

    const current = siblings[idx];
    const neighbor = siblings[swapIdx];

    await db.transaction(async (trx) => {
      await trx
        .update(lessons)
        .set({ sortOrder: -1 - current.sortOrder })
        .where(eq(lessons.id, current.id));
      await trx
        .update(lessons)
        .set({ sortOrder: current.sortOrder })
        .where(eq(lessons.id, neighbor.id));
      await trx
        .update(lessons)
        .set({ sortOrder: neighbor.sortOrder })
        .where(eq(lessons.id, current.id));
    });

    const [updated] = await db.select().from(lessons).where(eq(lessons.id, lessonId));
    return NextResponse.json({ lesson: updated });
  }

  const patch: Partial<typeof lessons.$inferInsert> = {};

  if (body.title !== undefined) {
    const title = String(body.title).trim();
    if (title.length < 2) {
      return NextResponse.json({ error: "Judul materi minimal 2 karakter" }, { status: 400 });
    }
    patch.title = title;
  }

  if (body.type !== undefined) {
    const type = String(body.type) as LessonType;
    if (!LESSON_TYPES.includes(type)) {
      return NextResponse.json({ error: "Tipe materi tidak valid" }, { status: 400 });
    }
    patch.type = type;
  }

  if (body.contentBody !== undefined) {
    patch.contentBody = body.contentBody;
  }

  if (body.isFreePreview !== undefined) {
    patch.isFreePreview = Boolean(body.isFreePreview);
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Tidak ada field yang diubah" }, { status: 400 });
  }

  const [updated] = await db
    .update(lessons)
    .set(patch)
    .where(eq(lessons.id, lessonId))
    .returning();

  return NextResponse.json({ lesson: updated });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ lessonId: string }> },
) {
  const user = await requireInstructor();
  const { lessonId } = await params;

  const ctx = await getOwnedLessonContext(lessonId, user);
  if (!ctx) {
    return NextResponse.json({ error: "Materi tidak ditemukan atau akses ditolak" }, { status: 404 });
  }

  const moduleId = ctx.lesson.moduleId;
  await db.delete(lessons).where(eq(lessons.id, lessonId));

  const remaining = await db
    .select()
    .from(lessons)
    .where(eq(lessons.moduleId, moduleId))
    .orderBy(asc(lessons.sortOrder));

  await db.transaction(async (trx) => {
    for (let i = 0; i < remaining.length; i++) {
      await trx
        .update(lessons)
        .set({ sortOrder: -1000 - i })
        .where(eq(lessons.id, remaining[i].id));
    }
    for (let i = 0; i < remaining.length; i++) {
      await trx.update(lessons).set({ sortOrder: i }).where(eq(lessons.id, remaining[i].id));
    }
  });

  return NextResponse.json({ ok: true });
}
