"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { CouponInput } from "@/components/coupon-input";
import { formatRupiah } from "@/lib/courses";

/**
 * Tombol aksi di halaman detail kursus (C4/C5/E4):
 *   - sudah enrollment  → "Lanjut Belajar" ke /learn/[slug]
 *   - gratis            → "Daftar Gratis" (enrollment langsung)
 *   - berbayar          → "Beli Kursus" → (opsional kupon) → checkout Midtrans
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
  const [coupon, setCoupon] = useState<{ code: string | null; finalPrice: number; discountAmount: number }>({
    code: null,
    finalPrice: price,
    discountAmount: 0,
  });

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
        body: JSON.stringify({ courseId, couponCode: coupon.code ?? undefined }),
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
    <div className="space-y-3">
      {price > 0 && (
        <CouponInput
          courseId={courseId}
          originalPrice={price}
          onApplied={setCoupon}
        />
      )}
      {coupon.discountAmount > 0 && (
        <div className="flex items-baseline gap-2 text-sm">
          <span className="text-zinc-500 line-through">{formatRupiah(price)}</span>
          <span className="text-lg font-bold text-emerald-400">{formatRupiah(coupon.finalPrice)}</span>
        </div>
      )}
      <button
        onClick={handleCheckout}
        disabled={busy}
        className="rounded-lg bg-emerald-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
      >
        {busy ? "Memproses..." : price === 0 ? "Daftar Gratis" : "Beli Kursus"}
      </button>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
