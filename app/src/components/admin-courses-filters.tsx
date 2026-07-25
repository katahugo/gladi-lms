"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type AdminCoursesFiltersProps = {
  q: string;
  category: string;
  status: string;
  categories: string[];
};

/**
 * Filter bar manajemen kursus — search + kategori + status via query string.
 */
export function AdminCoursesFilters({
  q: initialQ,
  category,
  status,
  categories,
}: AdminCoursesFiltersProps) {
  const router = useRouter();
  const [q, setQ] = useState(initialQ);

  function push(next: { q?: string; category?: string; status?: string }) {
    const params = new URLSearchParams();
    const qq = (next.q ?? q).trim();
    const cat = next.category ?? category;
    const st = next.status ?? status;
    if (qq) params.set("q", qq);
    if (cat) params.set("category", cat);
    if (st) params.set("status", st);
    const qs = params.toString();
    router.push(qs ? `/admin/courses?${qs}` : "/admin/courses");
  }

  function onSearch(e: FormEvent) {
    e.preventDefault();
    push({ q });
  }

  return (
    <div className="flex flex-col items-center justify-between gap-unit-4 border-b border-outline-variant p-unit-4 md:flex-row">
      <form onSubmit={onSearch} className="flex w-full items-center gap-unit-3 md:w-auto">
        <div className="relative w-full md:w-80">
          <span className="material-symbols-outlined absolute top-1/2 left-3 -translate-y-1/2 text-sm text-outline">
            search
          </span>
          <input
            className="w-full rounded-lg border border-outline-variant bg-surface py-2.5 pr-4 pl-10 text-sm text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            placeholder="Cari judul kursus..."
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <button
          type="submit"
          className="rounded-lg border border-outline-variant bg-surface p-2.5 transition-colors hover:bg-surface-container"
          aria-label="Filter"
        >
          <span className="material-symbols-outlined text-on-surface-variant">tune</span>
        </button>
      </form>

      <div className="flex w-full gap-unit-3 md:w-auto">
        <select
          className="flex-1 rounded-lg border border-outline-variant bg-surface px-3 py-2.5 text-sm text-on-surface md:w-40"
          value={category}
          onChange={(e) => push({ category: e.target.value, q })}
        >
          <option value="">Semua Kategori</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          className="flex-1 rounded-lg border border-outline-variant bg-surface px-3 py-2.5 text-sm text-on-surface md:w-40"
          value={status}
          onChange={(e) => push({ status: e.target.value, q })}
        >
          <option value="">Semua Status</option>
          <option value="published">Aktif</option>
          <option value="archived">Review</option>
          <option value="draft">Draft</option>
        </select>
      </div>
    </div>
  );
}
