"use client";

import { useEffect, useState } from "react";
import { formatRupiah } from "@/lib/courses";

type Coupon = {
  id: string;
  code: string;
  discountType: "percent" | "fixed";
  value: number;
  maxUses: number | null;
  usedCount: number;
  courseId: string | null;
  expiresAt: string | null;
  isActive: boolean;
};

export default function AdminCouponsPage() {
  const [rows, setRows] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ code: "", discountType: "percent" as const, value: "", maxUses: "", expiresAt: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/admin/coupons");
    const json = (await res.json()) as { coupons: Coupon[] };
    setRows(json.coupons ?? []);
    setLoading(false);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/admin/coupons");
      const json = (await res.json()) as { coupons: Coupon[] };
      if (!cancelled) {
        setRows(json.coupons ?? []);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: form.code,
          discountType: form.discountType,
          value: Number(form.value),
          maxUses: form.maxUses ? Number(form.maxUses) : undefined,
          expiresAt: form.expiresAt || undefined,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Gagal membuat kupon");
      setForm({ code: "", discountType: "percent", value: "", maxUses: "", expiresAt: "" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(id: string, isActive: boolean) {
    await fetch(`/api/admin/coupons/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    await load();
  }

  async function remove(id: string) {
    if (!confirm("Hapus kupon ini?")) return;
    await fetch(`/api/admin/coupons/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div className="mx-auto max-w-4xl p-6 md:p-margin-desktop">
      <h1 className="mb-8 font-headline text-headline-md font-bold text-primary">Kupon Diskon</h1>

      <div className="tech-shadow mb-8 rounded-xl border border-outline-variant bg-surface-container-lowest p-5">
        <h2 className="mb-3 font-headline font-semibold text-on-surface">Buat Kupon Baru</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
            placeholder="KODE (mis. PROMO50)"
            className="rounded-md border border-outline-variant bg-surface-container px-3 py-2 font-mono uppercase text-on-surface outline-none focus:border-primary"
          />
          <select
            value={form.discountType}
            onChange={(e) => setForm({ ...form, discountType: e.target.value as "percent" })}
            className="rounded-md border border-outline-variant bg-surface-container px-3 py-2 text-on-surface"
          >
            <option value="percent">Persen (%)</option>
            <option value="fixed">Nominal (Rp)</option>
          </select>
          <input
            value={form.value}
            onChange={(e) => setForm({ ...form, value: e.target.value.replace(/[^\d]/g, "") })}
            placeholder={form.discountType === "percent" ? "Nilai % (1-100)" : "Nominal Rupiah"}
            inputMode="numeric"
            className="rounded-md border border-outline-variant bg-surface-container px-3 py-2 text-on-surface outline-none focus:border-primary"
          />
          <input
            value={form.maxUses}
            onChange={(e) => setForm({ ...form, maxUses: e.target.value.replace(/[^\d]/g, "") })}
            placeholder="Maks pemakaian (opsional)"
            inputMode="numeric"
            className="rounded-md border border-outline-variant bg-surface-container px-3 py-2 text-on-surface outline-none focus:border-primary"
          />
          <input
            type="date"
            value={form.expiresAt}
            onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
            className="rounded-md border border-outline-variant bg-surface-container px-3 py-2 text-on-surface outline-none focus:border-primary"
          />
        </div>
        {error && <p className="mt-2 text-xs text-error">{error}</p>}
        <button
          onClick={create}
          disabled={busy || !form.code.trim() || !form.value}
          className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Membuat..." : "Buat Kupon"}
        </button>
      </div>

      {loading ? (
        <p className="text-on-surface-variant">Memuat...</p>
      ) : rows.length === 0 ? (
        <p className="tech-shadow rounded-xl border border-outline-variant bg-surface-container-lowest p-8 text-center text-on-surface-variant">
          Belum ada kupon.
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((c) => (
            <li
              key={c.id}
              className="tech-shadow flex flex-wrap items-center justify-between gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-4"
            >
              <div>
                <p className="font-mono font-bold text-on-surface">{c.code}</p>
                <p className="text-xs text-on-surface-variant">
                  {c.discountType === "percent" ? `${c.value}%` : formatRupiah(c.value)} · terpakai{" "}
                  {c.usedCount}
                  {c.maxUses ? `/${c.maxUses}` : ""}
                  {c.expiresAt && ` · s.d. ${new Date(c.expiresAt).toLocaleDateString("id-ID")}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggle(c.id, c.isActive)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                    c.isActive
                      ? "bg-primary-container/40 text-on-primary-container hover:bg-primary-container/60"
                      : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
                  }`}
                >
                  {c.isActive ? "Aktif" : "Nonaktif"}
                </button>
                <button
                  onClick={() => remove(c.id)}
                  className="rounded-md bg-error-container px-3 py-1.5 text-xs font-semibold text-on-error-container hover:opacity-90"
                >
                  Hapus
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
