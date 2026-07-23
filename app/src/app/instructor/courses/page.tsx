import { desc, eq } from "drizzle-orm";
import Link from "next/link";

import { db } from "@/db";
import { courses } from "@/db/schema";
import { requireInstructor } from "@/lib/guards";
import { formatRupiah } from "@/lib/courses";
import { CourseRowActions } from "./row-actions";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  draft: { text: "Draft", cls: "bg-zinc-600/30 text-zinc-300" },
  published: { text: "Terbit", cls: "bg-emerald-600/20 text-emerald-400" },
  archived: { text: "Arsip", cls: "bg-amber-600/20 text-amber-400" },
};

export default async function InstructorCoursesPage() {
  const user = await requireInstructor();

  // Admin melihat semua kursus; instruktur hanya miliknya
  const rows =
    user.role === "admin"
      ? await db.select().from(courses).orderBy(desc(courses.createdAt))
      : await db
          .select()
          .from(courses)
          .where(eq(courses.instructorId, user.id))
          .orderBy(desc(courses.createdAt));

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Kursus Saya</h1>
        <Link
          href="/instructor/courses/new"
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
        >
          + Kursus Baru
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-center text-zinc-400">
          Belum ada kursus. Klik &ldquo;Kursus Baru&rdquo; untuk membuat yang pertama.
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((c) => (
            <li
              key={c.id}
              className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_LABEL[c.status]?.cls}`}>
                    {STATUS_LABEL[c.status]?.text ?? c.status}
                  </span>
                  {c.category && (
                    <span className="text-xs text-zinc-500">{c.category}</span>
                  )}
                </div>
                <p className="mt-1 font-semibold text-white">{c.title}</p>
                <p className="text-sm text-zinc-400">{formatRupiah(c.price)}</p>
              </div>
              <CourseRowActions id={c.id} status={c.status} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
