"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Tombol aksi di halaman detail kursus (C4/C5):
 *   - sudah enrollment  → "Lanjut Belajar" ke /learn/[slug]
 *   - gratis            → "Daftar Gratis" (enrollment langsung)
 *   - berbayar          → "Beli Kursus" → checkout Midtrans → redirect paymentUrl
 */
export function CourseActionButton({
  courseId,
  slug,
  price,
  isLoggedIn,
  isEnrolled,
}: {
  courseId: string;
  slug: string;
  price: number;
  isLoggedIn: boolean;
  isEnrolled: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isEnrolled) {
    return (
      <button
        onClick={() => router.push(`/learn/${slug}`)}
        className="rounded-lg bg-emerald-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-emerald-500"
      >
        Lanjut Belajar
      </button>
    );
  }

  async function handleCheckout() {
    if (!isLoggedIn) {
      router.push(`/login?callbackUrl=/courses/${slug}`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId }),
      });
      const json = (await res.json()) as {
        free?: boolean;
        enrolled?: boolean;
        paymentUrl?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? "Checkout gagal");

      if (json.free && json.enrolled) {
        router.push(`/learn/${slug}`);
        router.refresh();
        return;
      }
      if (json.paymentUrl) {
        window.location.href = json.paymentUrl; // ke halaman pembayaran Midtrans
        return;
      }
      throw new Error("Respons checkout tidak dikenal");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleCheckout}
        disabled={busy}
        className="rounded-lg bg-emerald-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
      >
        {busy ? "Memproses..." : price === 0 ? "Daftar Gratis" : "Beli Kursus"}
      </button>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
