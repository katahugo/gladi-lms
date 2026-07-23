import Link from "next/link";
import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { courses, enrollments, users } from "@/db/schema";
import { requireInstructor } from "@/lib/guards";
import { getInstructorStats } from "@/lib/reports";
import { formatRupiah } from "@/lib/courses";

export const dynamic = "force-dynamic";

/**
 * Dashboard instruktur (E3) — ringkasan kursus miliknya, statistik enrollment,
 * pendapatan (transaksi paid), dan sertifikat yang telah terbit.
 * Admin juga bisa mengakses; melihat data hanya untuk instructor yang dipilih
 * (untuk kesederhanaan, admin di dashboard ini melihat data global — lihat
 * /admin untuk view admin).
 */
export default async function InstructorDashboard() {
  const user = await requireInstructor();
  const stats = await getInstructorStats(user.id);

  // Kursus terbaru + enrollment terkini (5 teratas)
  const myCourses = await db
    .select({
      id: courses.id,
      title: courses.title,
      slug: courses.slug,
      status: courses.status,
      price: courses.price,
      createdAt: courses.createdAt,
    })
    .from(courses)
    .where(eq(courses.instructorId, user.id))
    .orderBy(desc(courses.createdAt))
    .limit(5);

  const courseIds = myCourses.map((c) => c.id);
  const recentEnrollments = courseIds.length
    ? await db
        .select({
          enrolledAt: enrollments.enrolledAt,
          userName: users.name,
          userEmail: users.email,
          courseTitle: courses.title,
          status: enrollments.status,
        })
        .from(enrollments)
        .leftJoin(users, eq(enrollments.userId, users.id))
        .leftJoin(courses, eq(enrollments.courseId, courses.id))
        .where(eq(courses.instructorId, user.id))
        .orderBy(desc(enrollments.enrolledAt))
        .limit(8)
    : [];

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Dashboard Instruktur</h1>
        <Link
          href="/instructor/courses"
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
        >
          Kelola Kursus
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Kursus" value={String(stats.totalCourses)} sub={`${stats.publishedCourses} terbit`} />
        <StatCard label="Total Enrollment" value={String(stats.totalEnrollments)} sub={`${stats.totalStudents} siswa unik`} />
        <StatCard label="Sertifikat" value={String(stats.totalCertificates)} sub="Terbit" />
        <StatCard label="Pendapatan" value={formatRupiah(stats.revenue)} sub={`${stats.transactionCount} transaksi`} />
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="mb-3 font-semibold text-white">Kursus Terbaru</h2>
          {myCourses.length === 0 ? (
            <p className="text-sm text-zinc-500">
              Belum ada kursus.{" "}
              <Link href="/instructor/courses/new" className="text-emerald-400 hover:underline">
                Buat sekarang
              </Link>
              .
            </p>
          ) : (
            <ul className="space-y-2">
              {myCourses.map((c) => (
                <li key={c.id} className="flex items-center justify-between rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm">
                  <div>
                    <p className="font-medium text-white">{c.title}</p>
                    <p className="text-xs text-zinc-500">
                      {c.status} · {formatRupiah(c.price)}
                    </p>
                  </div>
                  <Link href={`/instructor/courses/${c.id}/edit`} className="text-xs text-emerald-400 hover:underline">
                    Edit
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="mb-3 font-semibold text-white">Pendaftaran Terkini</h2>
          {recentEnrollments.length === 0 ? (
            <p className="text-sm text-zinc-500">Belum ada pendaftaran.</p>
          ) : (
            <ul className="space-y-2">
              {recentEnrollments.map((e, i) => (
                <li key={i} className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm">
                  <p className="font-medium text-white">{e.userName ?? e.userEmail}</p>
                  <p className="text-xs text-zinc-500">
                    {e.courseTitle} · {new Date(e.enrolledAt).toLocaleDateString("id-ID")} · {e.status}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-white">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-zinc-500">{sub}</p>}
    </div>
  );
}
