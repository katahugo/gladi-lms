"use client";

import { useState } from "react";

/**
 * Tombol "Tandai Selesai" — mencatat lesson selesai ke /api/progress.
 * Dipakai di halaman belajar (C5).
 */
export function MarkCompleteButton({
  lessonId,
  initialCompleted,
  onDone,
}: {
  lessonId: string;
  initialCompleted: boolean;
  onDone?: () => void;
}) {
  const [completed, setCompleted] = useState(initialCompleted);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function markComplete() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId, completed: true, percentComplete: 100 }),
      });
      if (!res.ok) {
        const j = (await res.json()) as { error?: string };
        throw new Error(j.error ?? "Gagal mencatat progress");
      }
      setCompleted(true);
      onDone?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setBusy(false);
    }
  }

  if (completed) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600/20 px-4 py-2 text-sm font-medium text-emerald-400">
        ✓ Selesai
      </span>
    );
  }

  return (
    <div>
      <button
        onClick={markComplete}
        disabled={busy}
        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
      >
        {busy ? "Mencatat..." : "Tandai Selesai"}
      </button>
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}
