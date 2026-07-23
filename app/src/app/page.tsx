import Link from "next/link";
import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { courses, users } from "@/db/schema";
import { formatRupiah } from "@/lib/courses";

export const dynamic = "force-dynamic";

/**
 * Landing page (E4) — halaman depan promosi dengan kursus unggulan,
 * proposisi nilai platform, dan CTA.
 */
export default async function Home() {
  const featured = await db
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
    .orderBy(desc(courses.createdAt))
    .limit(3);

  return (
    <div className="bg-zinc-950 font-sans">
      {/* Hero */}
      <section className="mx-auto flex max-w-5xl flex-col items-center px-6 pb-20 pt-24 text-center">
        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-sm font-medium text-emerald-400">
          Platform Kursus Digital Indonesia
        </span>
        <h1 className="mt-6 text-4xl font-bold leading-tight tracking-tight text-white sm:text-6xl">
          Kuasai Keterampilan Baru,
          <br />
          <span className="text-emerald-400">Kapan Saja, di Mana Saja</span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-400">
          Gladi LMS menghubungkan Anda dengan instruktur terbaik. Belajar lewat video
          berkualitas, kuis interaktif, dan raih sertifikat terverifikasi.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <Link
            href="/courses"
            className="rounded-lg bg-emerald-600 px-8 py-3.5 text-base font-semibold text-white transition-colors hover:bg-emerald-500"
          >
            Jelajahi Kursus
          </Link>
          <a
            href="https://wa.me/6281234567890?text=Halo,%20saya%20ingin%20bertanya%20tentang%20Gladi%20LMS"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-zinc-700 px-8 py-3.5 text-base font-medium text-zinc-200 transition-colors hover:bg-zinc-800"
          >
            Tanya via WhatsApp
          </a>
        </div>
      </section>

      {/* Keunggulan */}
      <section className="border-t border-zinc-900 bg-zinc-900/40 py-16">
        <div className="mx-auto grid max-w-5xl gap-8 px-6 sm:grid-cols-3">
          {[
            { title: "Video Adaptif", desc: "Streaming berkualitas dengan resume otomatis di semua perangkat." },
            { title: "Kuis & Sertifikat", desc: "Uji pemahaman dengan auto-grading dan raih sertifikat terverifikasi publik." },
            { title: "Akses Selamanya", desc: "Sekali beli, akses materi selamanya termasuk pembaruan konten." },
          ].map((f) => (
            <div key={f.title} className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
              <h3 className="font-semibold text-white">{f.title}</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-400">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Kursus unggulan */}
      {featured.length > 0 && (
        <section className="mx-auto max-w-6xl px-6 py-16">
          <div className="mb-8 flex items-end justify-between">
            <h2 className="text-2xl font-bold text-white">Kursus Terbaru</h2>
            <Link href="/courses" className="text-sm text-emerald-400 hover:underline">
              Lihat semua →
            </Link>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((c) => (
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
                <h3 className="text-lg font-semibold text-white group-hover:text-emerald-400">
                  {c.title}
                </h3>
                <p className="mt-1 line-clamp-3 flex-1 text-sm text-zinc-400">
                  {c.description ?? ""}
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
        </section>
      )}

      {/* CTA akhir */}
      <section className="border-t border-zinc-900 bg-emerald-600/5 py-16 text-center">
        <h2 className="text-2xl font-bold text-white">Siap Mulai Belajar?</h2>
        <p className="mt-2 text-zinc-400">Daftar gratis dan mulai perjalanan belajar Anda hari ini.</p>
        <Link
          href="/login"
          className="mt-6 inline-block rounded-lg bg-emerald-600 px-8 py-3 font-semibold text-white hover:bg-emerald-500"
        >
          Daftar Sekarang
        </Link>
      </section>
    </div>
  );
}
