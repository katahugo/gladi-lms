import { asc, desc, eq } from "drizzle-orm";
import Link from "next/link";

import { db } from "@/db";
import { courses, enrollments, lessons, modules, progress, users } from "@/db/schema";
import { requireInstructor } from "@/lib/guards";

export const dynamic = "force-dynamic";

/**
 * Progres siswa per kursus (instruktur) — siapa yang terdaftar dan sejauh mana
 * penyelesaian materinya.
 */
export default async function CourseStudentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await requireInstructor();
  const { id } = await params;

  const course = await db.query.courses.findFirst({ where: eq(courses.id, id) });
  if (!course || (me.role !== "admin" && course.instructorId !== me.id)) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-10 text-zinc-400">Kursus tidak ditemukan.</div>
    );
  }

  const mods = await db
    .select()
    .from(modules)
    .where(eq(modules.courseId, id))
    .orderBy(asc(modules.sortOrder));
  const modIds = mods.map((m) => m.id);
  const allLessons = modIds.length ? await db.select().from(lessons) : [];
  const courseLessons = allLessons.filter((l) => modIds.includes(l.moduleId));
  const totalLessons = courseLessons.length;

  const enrolls = await db
    .select({
      id: enrollments.id,
      status: enrollments.status,
      enrolledAt: enrollments.enrolledAt,
      completedAt: enrollments.completedAt,
      userId: enrollments.userId,
      userName: users.name,
      userEmail: users.email,
    })
    .from(enrollments)
    .leftJoin(users, eq(enrollments.userId, users.id))
    .where(eq(enrollments.courseId, id))
    .orderBy(desc(enrollments.enrolledAt));

  const userIds = enrolls.map((e) => e.userId);
  const allProgress = userIds.length
    ? await db.select().from(progress)
    : [];

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8">
        <Link href="/instructor/dashboard" className="text-sm text-emerald-400 hover:underline">
          ← Dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-white">Progres Siswa — {course.title}</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {enrolls.length} siswa · {totalLessons} materi
        </p>
      </div>

      {enrolls.length === 0 ? (
        <p className="rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-center text-zinc-400">
          Belum ada siswa terdaftar.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-800 bg-zinc-900 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-3">Siswa</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Progres</th>
                <th className="px-4 py-3">Terdaftar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800 bg-zinc-950">
              {enrolls.map((e) => {
                const userProg = allProgress.filter(
                  (p) => p.userId === e.userId && courseLessons.some((l) => l.id === p.lessonId),
                );
                const done = userProg.filter((p) => p.completedAt).length;
                const pct = totalLessons > 0 ? Math.round((done / totalLessons) * 100) : 0;
                return (
                  <tr key={e.id}>
                    <td className="px-4 py-3">
                      <p className="text-white">{e.userName ?? "-"}</p>
                      <p className="text-xs text-zinc-500">{e.userEmail}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-semibold ${
                          e.status === "completed"
                            ? "bg-emerald-600/20 text-emerald-400"
                            : e.status === "active"
                              ? "bg-sky-600/20 text-sky-400"
                              : "bg-zinc-600/20 text-zinc-400"
                        }`}
                      >
                        {e.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-28 overflow-hidden rounded-full bg-zinc-800">
                          <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-zinc-400">
                          {done}/{totalLessons} ({pct}%)
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-500">
                      {new Date(e.enrolledAt).toLocaleDateString("id-ID")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
