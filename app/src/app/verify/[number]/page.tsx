import { eq } from "drizzle-orm";

import { db } from "@/db";
import { certificates, courses, users } from "@/db/schema";

/**
 * /verify/[number] — halaman verifikasi publik sertifikat.
 *
 * Diakses siapa saja (mis. HRD memverifikasi peserta) tanpa login. Menampilkan
 * data non-sensitif: nama, judul kursus, instruktur, tanggal terbit.
 */
export const dynamic = "force-dynamic";

export default async function VerifyPage({
  params,
}: {
  params: Promise<{ number: string }>;
}) {
  const { number } = await params;
  const normalized = number.trim().toUpperCase();

  const cert = await db.query.certificates.findFirst({
    where: eq(certificates.certificateNumber, normalized),
  });

  if (!cert) {
    return (
      <div className="mx-auto max-w-xl px-6 py-16 text-center">
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-8">
          <h1 className="text-2xl font-bold text-red-400">Sertifikat Tidak Ditemukan</h1>
          <p className="mt-2 text-sm text-red-300/80">
            Nomor <code className="rounded bg-red-500/10 px-1.5 py-0.5">{normalized}</code> tidak
            tercatat sebagai sertifikat terbitan Gladi LMS.
          </p>
        </div>
      </div>
    );
  }

  const [holder, course] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, cert.userId) }),
    db.query.courses.findFirst({ where: eq(courses.id, cert.courseId) }),
  ]);
  const instructor = course?.instructorId
    ? await db.query.users.findFirst({ where: eq(users.id, course.instructorId) })
    : null;

  const issued = new Date(cert.issuedAt).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-8 text-center">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
          ✓ SERTIFIKAT VALID
        </div>
        <h1 className="mt-4 text-3xl font-bold text-white">Sertifikat Gladi LMS</h1>
        <p className="mt-1 font-mono text-sm text-emerald-400">{cert.certificateNumber}</p>

        <div className="mt-8 space-y-4 text-left">
          <Field label="Nama Peserta" value={holder?.name ?? "-"} />
          <Field label="Judul Kursus" value={course?.title ?? "-"} />
          <Field label="Instruktur" value={instructor?.name ?? "-"} />
          <Field label="Tanggal Terbit" value={issued} />
        </div>

        <p className="mt-8 text-xs text-zinc-500">
          Sertifikat ini diterbitkan secara otomatis oleh platform Gladi LMS setelah peserta
          menyelesaikan seluruh materi kursus. Halaman ini dapat diakses publik sebagai bukti
          keaslian.
        </p>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col rounded-lg border border-zinc-800 bg-zinc-900 p-3">
      <span className="text-xs uppercase tracking-wide text-zinc-500">{label}</span>
      <span className="mt-0.5 font-medium text-white">{value}</span>
    </div>
  );
}
