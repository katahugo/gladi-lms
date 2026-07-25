import { NextResponse } from "next/server";
import { eq, max } from "drizzle-orm";

import { db } from "@/db";
import { lessons } from "@/db/schema";
import { requireInstructor } from "@/lib/guards";
import { getOwnedModuleContext } from "@/lib/instructor-access";

const LESSON_TYPES = ["video", "text", "quiz", "assignment"] as const;
type LessonType = (typeof LESSON_TYPES)[number];

/**
 * POST — buat lesson baru di akhir urutan modul.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ moduleId: string }> },
) {
  const user = await requireInstructor();
  const { moduleId } = await params;

  const ctx = await getOwnedModuleContext(moduleId, user);
  if (!ctx) {
    return NextResponse.json({ error: "Modul tidak ditemukan atau akses ditolak" }, { status: 404 });
  }

  let body: { title?: string; type?: string } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Body bukan JSON valid" }, { status: 400 });
  }

  const title = String(body.title ?? "").trim();
  if (title.length < 2) {
    return NextResponse.json({ error: "Judul materi minimal 2 karakter" }, { status: 400 });
  }

  const type = String(body.type ?? "video") as LessonType;
  if (!LESSON_TYPES.includes(type)) {
    return NextResponse.json({ error: "Tipe materi tidak valid" }, { status: 400 });
  }

  const [agg] = await db
    .select({ m: max(lessons.sortOrder) })
    .from(lessons)
    .where(eq(lessons.moduleId, moduleId));
  const nextOrder = (agg?.m ?? -1) + 1;

  const [created] = await db
    .insert(lessons)
    .values({
      moduleId,
      title,
      type,
      sortOrder: nextOrder,
    })
    .returning();

  return NextResponse.json({ lesson: created }, { status: 201 });
}
