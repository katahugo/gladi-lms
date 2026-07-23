import { and, asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { db } from "@/db";
import { courses, enrollments, lessons, modules, users } from "@/db/schema";
import { formatRupiah } from "@/lib/courses";
import { CourseActionButton } from "@/components/course-action-button";

export const dynamic = "force-dynamic";

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const course = await db.query.courses.findFirst({
    where: eq(courses.slug, slug),
  });
  if (!course || course.status !== "published") notFound();

  const instructor = course.instructorId
    ? await db.query.users.findFirst({ where: eq(users.id, course.instructorId) })
    : null;

  // Status enrollment pengunjung (untuk tombol aksi)
  const session = await auth();
  let isEnrolled = false;
  if (session?.user) {
    const enr = await db.query.enrollments.findFirst({
      where: and(
        eq(enrollments.userId, session.user.id),
        eq(enrollments.courseId, course.id),
        eq(enrollments.status, "active"),
      ),
    });
    isEnrolled = Boolean(enr);
  }

  const mods = await db
    .select()
    .from(modules)
    .where(eq(modules.courseId, course.id))
    .orderBy(asc(modules.sortOrder));

  const modIds = mods.map((m) => m.id);
  const allLessons = modIds.length
    ? await db.select().from(lessons).orderBy(asc(lessons.sortOrder))
    : [];

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      {course.category && (
        <span className="text-xs font-medium uppercase tracking-wide text-emerald-400">
          {course.category}
        </span>
      )}
      <h1 className="mt-1 text-3xl font-bold text-white">{course.title}</h1>
      <p className="mt-1 text-sm text-zinc-500">
        oleh {instructor?.name ?? "Instruktur"}
      </p>

      <p className="mt-6 whitespace-pre-line text-zinc-300">
        {course.description ?? "Belum ada deskripsi untuk kursus ini."}
      </p>

      <div className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <div className="flex items-center justify-between">
          <span className="text-2xl font-bold text-emerald-400">
            {course.price === 0 ? "Gratis" : formatRupiah(course.price)}
          </span>
          <CourseActionButton
            courseId={course.id}
            slug={course.slug}
            price={course.price}
            isLoggedIn={Boolean(session?.user)}
            isEnrolled={isEnrolled}
          />
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          Checkout & pembayaran tersedia pada Tahap C4.
        </p>
      </div>

      <section className="mt-10">
        <h2 className="mb-4 text-xl font-semibold text-white">Kurikulum</h2>
        {mods.length === 0 ? (
          <p className="text-zinc-500">Kurikulum akan segera tersedia.</p>
        ) : (
          <ol className="space-y-4">
            {mods.map((m, i) => {
              const modLessons = allLessons.filter((l) => l.moduleId === m.id);
              return (
                <li key={m.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                  <p className="font-semibold text-white">
                    {i + 1}. {m.title}
                  </p>
                  {modLessons.length > 0 && (
                    <ul className="mt-2 space-y-1 text-sm text-zinc-400">
                      {modLessons.map((l) => (
                        <li key={l.id} className="flex items-center gap-2">
                          <span className="text-zinc-600">•</span>
                          {l.title}
                          {l.isFreePreview && (
                            <span className="rounded bg-emerald-600/20 px-1.5 py-0.5 text-[10px] text-emerald-400">
                              Preview
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
