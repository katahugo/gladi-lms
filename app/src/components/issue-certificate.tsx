"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Tombol "Terbitkan Sertifikat" — tampil di halaman belajar saat siswa
 * sudah menyelesaikan semua materi. Panggil /api/certificates dan arahkan
 * ke halaman verifikasi publik setelah sukses.
 */
export function IssueCertificateButton({
  courseId,
  existingNumber,
}: {
  courseId: string;
  existingNumber?: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [number, setNumber] = useState<string | null>(existingNumber ?? null);

  if (number) {
    return (
      <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4">
        <p className="text-sm font-semibold text-emerald-300">Sertifikat sudah terbit</p>
        <p className="mt-1 font-mono text-xs text-emerald-400">{number}</p>
        <button
          onClick={() => router.push(`/verify/${number}`)}
          className="mt-2 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
        >
          Lihat halaman verifikasi
        </button>
      </div>
    );
  }

  async function issue() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/certificates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId }),
      });
      const json = (await res.json()) as { certificateNumber?: string; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Gagal menerbitkan sertifikat");
      if (json.certificateNumber) {
        setNumber(json.certificateNumber);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
      <p className="text-sm font-semibold text-emerald-300">
        🎓 Anda telah menyelesaikan seluruh materi!
      </p>
      <p className="mt-1 text-xs text-zinc-400">
        Terbitkan sertifikat kelulusan yang bisa diverifikasi publik.
      </p>
      <button
        onClick={issue}
        disabled={busy}
        className="mt-3 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
      >
        {busy ? "Menerbitkan..." : "Terbitkan Sertifikat"}
      </button>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
