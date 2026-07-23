import { and, asc, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { db } from "@/db";
import { courses, enrollments, lessons, modules, progress } from "@/db/schema";
import { VideoPlayer } from "@/components/video-player";
import { MarkCompleteButton } from "@/components/mark-complete";

export const dynamic = "force-dynamic";

/**
 * Halaman belajar siswa (C5) — menampilkan kurikulum + konten lesson aktif
 * dengan progress tracking.
 * Akses: hanya siswa dengan enrollment aktif.
 */
export default async function LearnPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ lesson?: string }>;
}) {
  const { slug } = await params;
  const { lesson: lessonParam } = await searchParams;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const course = await db.query.courses.findFirst({ where: eq(courses.slug, slug) });
  if (!course) notFound();

  const enrollment = await db.query.enrollments.findFirst({
    where: and(
      eq(enrollments.userId, session.user.id),
      eq(enrollments.courseId, course.id),
      eq(enrollments.status, "active"),
    ),
  });
  if (!enrollment) redirect(`/courses/${slug}`);

  const mods = await db
    .select()
    .from(modules)
    .where(eq(modules.courseId, course.id))
    .orderBy(asc(modules.sortOrder));

  const modIds = mods.map((m) => m.id);
  const allLessons = modIds.length
    ? await db.select().from(lessons).orderBy(asc(lessons.sortOrder))
    : [];

  const userProgress = await db
    .select()
    .from(progress)
    .where(eq(progress.userId, session.user.id));
  const progressMap = new Map(userProgress.map((p) => [p.lessonId, p]));

  // Lesson aktif: dari query param, atau lesson pertama
  const activeLesson =
    allLessons.find((l) => l.id === lessonParam) ?? allLessons[0] ?? null;

  const totalLessons = allLessons.length;
  const completedLessons = allLessons.filter((l) => progressMap.get(l.id)?.completedAt).length;
  const percentCourse = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">{course.title}</h1>
        <div className="mt-2 flex items-center gap-3">
          <div className="h-2 w-48 overflow-hidden rounded-full bg-zinc-800">
            <div className="h-full bg-emerald-500" style={{ width: `${percentCourse}%` }} />
          </div>
          <span className="text-sm text-zinc-400">
            {completedLessons}/{totalLessons} materi ({percentCourse}%)
          </span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Konten lesson aktif */}
        <div className="lg:col-span-2">
          {activeLesson ? (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">{activeLesson.title}</h2>
                <MarkCompleteButton
                  lessonId={activeLesson.id}
                  initialCompleted={Boolean(progressMap.get(activeLesson.id)?.completedAt)}
                />
              </div>
              {activeLesson.type === "video" && activeLesson.contentRef?.startsWith("cf:") ? (
                <VideoPlayer lessonId={activeLesson.id} title={activeLesson.title} />
              ) : activeLesson.type === "text" && activeLesson.contentBody ? (
                <div className="prose prose-invert max-w-none rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-zinc-300">
                  {activeLesson.contentBody}
                </div>
              ) : (
                <div className="flex aspect-video items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-500">
                  Konten belum tersedia untuk materi ini.
                </div>
              )}
            </div>
          ) : (
            <div className="flex aspect-video items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-500">
              Belum ada materi di kursus ini.
            </div>
          )}
        </div>

        {/* Sidebar kurikulum */}
        <aside className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <h3 className="mb-3 font-semibold text-white">Kurikulum</h3>
          {mods.length === 0 ? (
            <p className="text-sm text-zinc-500">Belum ada modul.</p>
          ) : (
            <div className="space-y-4">
              {mods.map((m) => {
                const modLessons = allLessons.filter((l) => l.moduleId === m.id);
                return (
                  <div key={m.id}>
                    <p className="mb-1.5 text-sm font-medium text-zinc-300">{m.title}</p>
                    <ul className="space-y-1">
                      {modLessons.map((l) => {
                        const done = Boolean(progressMap.get(l.id)?.completedAt);
                        const isActive = activeLesson?.id === l.id;
                        return (
                          <li key={l.id}>
                            <a
                              href={`/learn/${slug}?lesson=${l.id}`}
                              className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
                                isActive
                                  ? "bg-emerald-600/20 text-emerald-400"
                                  : "text-zinc-400 hover:bg-zinc-800"
                              }`}
                            >
                              <span className={done ? "text-emerald-400" : "text-zinc-600"}>
                                {done ? "✓" : "○"}
                              </span>
                              <span className="flex-1">{l.title}</span>
                            </a>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
