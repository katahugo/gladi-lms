import { desc, eq } from "drizzle-orm";
import Link from "next/link";

import { auth } from "@/auth";
import { db } from "@/db";
import { certificates, courses } from "@/db/schema";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function CertificatesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/dashboard/certificates");

  const rows = await db
    .select({
      id: certificates.id,
      number: certificates.certificateNumber,
      issuedAt: certificates.issuedAt,
      courseTitle: courses.title,
      courseSlug: courses.slug,
    })
    .from(certificates)
    .leftJoin(courses, eq(certificates.courseId, courses.id))
    .where(eq(certificates.userId, session.user.id))
    .orderBy(desc(certificates.issuedAt));

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="mb-8 text-2xl font-bold text-white">Sertifikat Saya</h1>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-center text-zinc-400">
          Belum ada sertifikat. Selesaikan seluruh materi kursus untuk menerbitkannya.
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((c) => (
            <li
              key={c.id}
              className="flex flex-col gap-2 rounded-xl border border-zinc-800 bg-zinc-900 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-semibold text-white">{c.courseTitle}</p>
                <p className="mt-0.5 font-mono text-xs text-emerald-400">{c.number}</p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  Terbit:{" "}
                  {new Date(c.issuedAt).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </div>
              <div className="flex gap-2">
                <Link
                  href={`/verify/${c.number}`}
                  className="rounded-md bg-emerald-600/20 px-3 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-600/30"
                >
                  Verifikasi Publik
                </Link>
                {c.courseSlug && (
                  <Link
                    href={`/learn/${c.courseSlug}`}
                    className="rounded-md bg-sky-600/20 px-3 py-1.5 text-xs font-semibold text-sky-400 hover:bg-sky-600/30"
                  >
                    Buka Kursus
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
