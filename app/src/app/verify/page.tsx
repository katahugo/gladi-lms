import Link from "next/link";

/**
 * /verify — landing halaman verifikasi (form input nomor).
 * Publik.
 */
export default function VerifyLanding() {
  async function handle(formData: FormData) {
    "use server";
    const number = String(formData.get("number") ?? "").trim();
    if (!number) return;
    const { redirect } = await import("next/navigation");
    redirect(`/verify/${encodeURIComponent(number.toUpperCase())}`);
  }

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col justify-center px-6 py-16">
      <h1 className="text-2xl font-bold text-white">Verifikasi Sertifikat</h1>
      <p className="mt-1 text-sm text-zinc-400">
        Masukkan nomor sertifikat (format <code className="text-emerald-400">GLD-YYYY-XXXXXX</code>)
        untuk memverifikasi keasliannya.
      </p>

      <form action={handle} className="mt-6 flex gap-2">
        <input
          name="number"
          required
          placeholder="GLD-2026-XXXXXX"
          className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 font-mono uppercase text-white outline-none focus:border-emerald-500"
        />
        <button
          type="submit"
          className="rounded-lg bg-emerald-600 px-5 py-2 font-semibold text-white hover:bg-emerald-500"
        >
          Verifikasi
        </button>
      </form>

      <p className="mt-6 text-xs text-zinc-500">
        Anda pemegang sertifikat? Buka daftar sertifikat Anda di{" "}
        <Link href="/dashboard/certificates" className="text-emerald-400 hover:underline">
          Dashboard
        </Link>
        .
      </p>
    </div>
  );
}
