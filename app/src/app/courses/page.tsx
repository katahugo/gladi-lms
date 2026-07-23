import { desc, eq } from "drizzle-orm";
import Link from "next/link";

import { db } from "@/db";
import { courses, users } from "@/db/schema";
import { formatRupiah } from "@/lib/courses";

export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  const rows = await db
    .select({
      id: courses.id,
      title: courses.title,
      slug: courses.slug,
      description: courses.description,
      price: courses.price,
      category: courses.category,
      instructorName: users.name,
    })
    .from(courses)
    .leftJoin(users, eq(courses.instructorId, users.id))
    .where(eq(courses.status, "published"))
    .orderBy(desc(courses.createdAt));

  const categories = [...new Set(rows.map((r) => r.category).filter(Boolean))] as string[];

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-10 text-center">
        <h1 className="text-3xl font-bold text-white sm:text-4xl">Katalog Kursus</h1>
        <p className="mt-2 text-zinc-400">Tingkatkan keterampilan Anda bersama instruktur terbaik.</p>
      </header>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-zinc-800 bg-zinc-900 p-10 text-center text-zinc-400">
          Belum ada kursus yang diterbitkan. Nantikan segera.
        </p>
      ) : (
        <>
          {categories.length > 0 && (
            <div className="mb-6 flex flex-wrap gap-2">
              {categories.map((cat) => (
                <span key={cat} className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-300">
                  {cat}
                </span>
              ))}
            </div>
          )}
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((c) => (
              <Link
                key={c.id}
                href={`/courses/${c.slug}`}
                className="group flex flex-col rounded-xl border border-zinc-800 bg-zinc-900 p-5 transition-colors hover:border-emerald-600/50"
              >
                {c.category && (
                  <span className="mb-2 text-xs font-medium uppercase tracking-wide text-emerald-400">
                    {c.category}
                  </span>
                )}
                <h2 className="text-lg font-semibold text-white group-hover:text-emerald-400">
                  {c.title}
                </h2>
                <p className="mt-1 line-clamp-3 flex-1 text-sm text-zinc-400">
                  {c.description ?? "Tidak ada deskripsi."}
                </p>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xs text-zinc-500">{c.instructorName ?? "Instruktur"}</span>
                  <span className="font-semibold text-emerald-400">
                    {c.price === 0 ? "Gratis" : formatRupiah(c.price)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
