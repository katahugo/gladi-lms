import { notFound } from "next/navigation";
import { asc, eq, inArray } from "drizzle-orm";
import Link from "next/link";

import { db } from "@/db";
import { lessons, modules } from "@/db/schema";
import { requireInstructor } from "@/lib/guards";
import { getOwnedCourse } from "@/lib/instructor-access";

import { CurriculumEditor, type CurriculumModule } from "./curriculum-editor";

export const dynamic = "force-dynamic";

/**
 * Course builder kurikulum (PRD §13 F1) — CRUD modul/lesson + upload + kuis.
 */
export default async function CurriculumPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireInstructor();
  const { id } = await params;

  const course = await getOwnedCourse(id, user);
  if (!course) notFound();

  const mods = await db
    .select()
    .from(modules)
    .where(eq(modules.courseId, id))
    .orderBy(asc(modules.sortOrder));

  const moduleIds = mods.map((m) => m.id);
  const allLessons =
    moduleIds.length === 0
      ? []
      : await db
          .select()
          .from(lessons)
          .where(inArray(lessons.moduleId, moduleIds))
          .orderBy(asc(lessons.sortOrder));

  const initialModules: CurriculumModule[] = mods.map((m) => ({
    id: m.id,
    courseId: m.courseId,
    title: m.title,
    sortOrder: m.sortOrder,
    lessons: allLessons
      .filter((l) => l.moduleId === m.id)
      .map((l) => ({
        id: l.id,
        moduleId: l.moduleId,
        title: l.title,
        type: l.type,
        contentRef: l.contentRef,
        contentBody: l.contentBody,
        sortOrder: l.sortOrder,
        isFreePreview: l.isFreePreview,
      })),
  }));

  return (
    <div>
      <div className="border-b border-zinc-800 px-6 py-3">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 text-sm">
          <Link href="/instructor/courses" className="text-zinc-500 hover:text-zinc-300">
            ← Kursus
          </Link>
          <span className="text-zinc-700">/</span>
          <Link
            href={`/instructor/courses/${id}/edit`}
            className="text-zinc-500 hover:text-zinc-300"
          >
            Metadata
          </Link>
          <span className="text-zinc-700">/</span>
          <span className="text-zinc-300">Kurikulum</span>
          <Link
            href={`/instructor/courses/${id}/students`}
            className="ml-auto text-emerald-400 hover:underline"
          >
            Progres siswa
          </Link>
        </div>
      </div>

      <CurriculumEditor
        courseId={course.id}
        courseTitle={course.title}
        initialModules={initialModules}
      />
    </div>
  );
}
