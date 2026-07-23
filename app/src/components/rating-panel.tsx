"use client";

import { useEffect, useState } from "react";

type Review = {
  id: string;
  rating: number;
  review: string | null;
  createdAt: string;
  userName: string | null;
};

/**
 * Panel rating + review kursus (E2). Menampilkan rata-rata bintang, form
 * kirim review (untuk yang enrolled), dan daftar review.
 */
export function RatingPanel({
  courseId,
  canReview,
}: {
  courseId: string;
  canReview: boolean;
}) {
  const [avg, setAvg] = useState(0);
  const [total, setTotal] = useState(0);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/reviews?courseId=${courseId}`);
        const json = (await res.json()) as {
          average: number;
          total: number;
          reviews: Review[];
        };
        if (!cancelled) {
          setAvg(json.average);
          setTotal(json.total);
          setReviews(json.reviews ?? []);
        }
      } catch {
        // abaikan; publik dan boleh kosong
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  async function submit() {
    setBusy(true);
    setError(null);
    setOk(false);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId, rating, review: text.trim() || null }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Gagal mengirim rating");
      setOk(true);
      // Reload
      const r2 = await fetch(`/api/reviews?courseId=${courseId}`);
      const j2 = (await r2.json()) as {
        average: number;
        total: number;
        reviews: Review[];
      };
      setAvg(j2.average);
      setTotal(j2.total);
      setReviews(j2.reviews ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <span key={n} className={n <= Math.round(avg) ? "text-amber-400" : "text-zinc-600"}>
              ★
            </span>
          ))}
        </div>
        <span className="text-sm text-zinc-300">
          {avg.toFixed(1)}{" "}
          <span className="text-zinc-500">({total} ulasan)</span>
        </span>
      </div>

      {canReview && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <p className="mb-2 text-sm font-medium text-zinc-200">Beri Rating & Ulasan</p>
          <div className="mb-2 flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                className={`text-2xl ${n <= rating ? "text-amber-400" : "text-zinc-600"} hover:text-amber-300`}
              >
                ★
              </button>
            ))}
            <span className="ml-2 text-xs text-zinc-500">({rating}/5)</span>
          </div>
          <textarea
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Bagikan pendapat Anda tentang kursus ini (opsional)..."
            className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
          />
          {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
          {ok && <p className="mt-1 text-xs text-emerald-400">Ulasan tersimpan.</p>}
          <button
            onClick={submit}
            disabled={busy}
            className="mt-2 rounded-md bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {busy ? "Menyimpan..." : "Kirim Ulasan"}
          </button>
        </div>
      )}

      {reviews.length > 0 ? (
        <ul className="space-y-2">
          {reviews.map((r) => (
            <li key={r.id} className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
              <div className="flex items-center gap-2 text-xs">
                <div className="flex items-center gap-0.5 text-amber-400">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <span key={n} className={n <= r.rating ? "" : "text-zinc-600"}>
                      ★
                    </span>
                  ))}
                </div>
                <span className="font-medium text-zinc-300">{r.userName ?? "Anon"}</span>
                <span className="text-zinc-500">
                  {new Date(r.createdAt).toLocaleDateString("id-ID")}
                </span>
              </div>
              {r.review && (
                <p className="mt-1 whitespace-pre-line text-sm text-zinc-300">{r.review}</p>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-zinc-500">Belum ada ulasan.</p>
      )}
    </div>
  );
}
