"use client";

import { useState } from "react";
import { formatRupiah } from "@/lib/courses";

/**
 * Input kode kupon di halaman detail kursus / checkout.
 * Memvalidasi via /api/coupons/validate dan melaporkan harga final ke parent.
 */
export function CouponInput({
  courseId,
  originalPrice,
  onApplied,
}: {
  courseId: string;
  originalPrice: number;
  onApplied: (result: { code: string | null; finalPrice: number; discountAmount: number }) => void;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState<{ code: string; finalPrice: number; discountAmount: number } | null>(null);

  async function apply() {
    if (!code.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim(), courseId }),
      });
      const json = (await res.json()) as {
        valid?: boolean;
        reason?: string;
        error?: string;
        code?: string;
        finalPrice?: number;
        discountAmount?: number;
      };
      if (!res.ok || !json.valid) {
        throw new Error(json.reason ?? json.error ?? "Kupon tidak valid");
      }
      const result = {
        code: json.code!,
        finalPrice: json.finalPrice!,
        discountAmount: json.discountAmount!,
      };
      setApplied(result);
      onApplied(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memvalidasi kupon");
      setApplied(null);
      onApplied({ code: null, finalPrice: originalPrice, discountAmount: 0 });
    } finally {
      setBusy(false);
    }
  }

  function remove() {
    setApplied(null);
    setCode("");
    onApplied({ code: null, finalPrice: originalPrice, discountAmount: 0 });
  }

  if (applied) {
    return (
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-emerald-300">
              Kupon {applied.code} diterapkan
            </p>
            <p className="text-xs text-zinc-400">
              Hemat {formatRupiah(applied.discountAmount)} · Harga final {formatRupiah(applied.finalPrice)}
            </p>
          </div>
          <button onClick={remove} className="text-xs text-zinc-500 hover:text-zinc-300">
            Hapus
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Kode kupon"
          className="flex-1 rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 font-mono text-sm uppercase text-white outline-none focus:border-emerald-500"
        />
        <button
          onClick={apply}
          disabled={busy || !code.trim()}
          className="rounded-md bg-zinc-700 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-600 disabled:opacity-50"
        >
          {busy ? "..." : "Pakai"}
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}
