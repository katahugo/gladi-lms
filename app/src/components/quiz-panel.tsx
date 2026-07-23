"use client";

import { useEffect, useState } from "react";

type QuizOption = { id: string; text: string };
type Question = {
  id: string;
  question: string;
  type: "multiple_choice" | "true_false" | "essay";
  options: QuizOption[] | null;
  points: number;
};
type Attempt = {
  id: string;
  attemptNumber: number;
  score: number | null;
  passed: boolean | null;
  status: "in_progress" | "submitted" | "graded";
  submittedAt: string | null;
};
type QuizData = {
  quiz: { id: string; lessonId: string; passingScore: number; maxAttempts: number };
  questions: Question[];
  attempts: Attempt[];
  attemptsRemaining: number;
};

/**
 * Komponen kuis siswa — menampilkan soal, menerima jawaban, submit, dan
 * menampilkan hasil auto-grading. Dipakai di halaman belajar (C5) untuk
 * lesson bertipe "quiz".
 */
export function QuizPanel({ lessonId }: { lessonId: string }) {
  const [data, setData] = useState<QuizData | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    score: number | null;
    passed: boolean | null;
    fullyAutoGraded: boolean;
    earnedPoints: number;
    totalPoints: number;
    passingScore: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/quizzes/${lessonId}`);
        const json = (await res.json()) as QuizData & { error?: string };
        if (!res.ok) throw new Error(json.error ?? "Gagal memuat kuis");
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Terjadi kesalahan");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [lessonId]);

  async function reload() {
    try {
      const res = await fetch(`/api/quizzes/${lessonId}`);
      const json = (await res.json()) as QuizData & { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Gagal memuat kuis");
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    }
  }

  async function submit() {
    if (!data) return;
    const unanswered = data.questions.filter((q) => !answers[q.id]?.trim());
    if (unanswered.length > 0) {
      setError(`Masih ada ${unanswered.length} soal yang belum dijawab`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/quizzes/${lessonId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const json = (await res.json()) as {
        score: number | null;
        passed: boolean | null;
        fullyAutoGraded: boolean;
        earnedPoints: number;
        totalPoints: number;
        passingScore: number;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? "Gagal submit");
      setResult(json);
      await reload(); // segarkan daftar attempts
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-zinc-500">
        Memuat kuis...
      </div>
    );
  }
  if (error && !data) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-red-400">
        {error}
      </div>
    );
  }
  if (!data) return null;

  const bestScore = data.attempts
    .map((a) => a.score)
    .filter((s): s is number => s !== null)
    .reduce((max, s) => Math.max(max, s), -Infinity);
  const lastAttempt = data.attempts[data.attempts.length - 1];
  const alreadyPassed = data.attempts.some((a) => a.passed === true);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
          <span className="text-zinc-400">
            Nilai lulus: <span className="text-white">{data.quiz.passingScore}</span>
          </span>
          <span className="text-zinc-400">
            Percobaan: <span className="text-white">{data.attempts.length}/{data.quiz.maxAttempts}</span>
          </span>
          {bestScore > -Infinity && (
            <span className="text-zinc-400">
              Skor terbaik: <span className="text-emerald-400">{bestScore}</span>
            </span>
          )}
          {alreadyPassed && (
            <span className="rounded bg-emerald-600/20 px-2 py-0.5 text-xs font-semibold text-emerald-400">
              ✓ LULUS
            </span>
          )}
        </div>

        {result && (
          <div
            className={`mb-4 rounded-lg border p-4 ${
              result.passed
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                : result.passed === false
                  ? "border-red-500/40 bg-red-500/10 text-red-300"
                  : "border-amber-500/40 bg-amber-500/10 text-amber-300"
            }`}
          >
            <p className="text-sm font-semibold">
              {result.fullyAutoGraded
                ? result.passed
                  ? `Selamat, Anda LULUS dengan skor ${result.score}!`
                  : `Belum lulus — skor ${result.score} (butuh ≥ ${result.passingScore}).`
                : "Jawaban tersimpan. Ada soal essay yang menunggu review manual dari instruktur."}
            </p>
            {result.totalPoints > 0 && (
              <p className="mt-1 text-xs opacity-80">
                Poin: {result.earnedPoints}/{result.totalPoints} (dari soal auto-grade)
              </p>
            )}
          </div>
        )}

        {error && (
          <p className="mb-3 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {error}
          </p>
        )}

        {data.attemptsRemaining === 0 && !alreadyPassed ? (
          <p className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-400">
            Batas percobaan sudah habis. Hubungi instruktur bila perlu reset.
          </p>
        ) : (
          <ol className="space-y-5">
            {data.questions.map((q, i) => (
              <li key={q.id}>
                <p className="mb-2 font-medium text-white">
                  <span className="text-emerald-400">{i + 1}.</span> {q.question}
                  <span className="ml-2 text-xs text-zinc-500">({q.points} poin)</span>
                </p>
                {q.type === "multiple_choice" && q.options && (
                  <div className="space-y-1.5">
                    {q.options.map((o) => (
                      <label
                        key={o.id}
                        className="flex cursor-pointer items-center gap-2 rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 hover:bg-zinc-800/50"
                      >
                        <input
                          type="radio"
                          name={q.id}
                          value={o.id}
                          checked={answers[q.id] === o.id}
                          onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                          disabled={alreadyPassed || busy}
                          className="accent-emerald-500"
                        />
                        <span className="text-sm text-zinc-200">{o.text}</span>
                      </label>
                    ))}
                  </div>
                )}
                {q.type === "true_false" && (
                  <div className="flex gap-2">
                    {["true", "false"].map((v) => (
                      <label
                        key={v}
                        className="flex cursor-pointer items-center gap-2 rounded-md border border-zinc-800 bg-zinc-950 px-4 py-2 hover:bg-zinc-800/50"
                      >
                        <input
                          type="radio"
                          name={q.id}
                          value={v}
                          checked={answers[q.id] === v}
                          onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                          disabled={alreadyPassed || busy}
                          className="accent-emerald-500"
                        />
                        <span className="text-sm text-zinc-200">
                          {v === "true" ? "Benar" : "Salah"}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
                {q.type === "essay" && (
                  <textarea
                    rows={4}
                    value={answers[q.id] ?? ""}
                    onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                    disabled={alreadyPassed || busy}
                    placeholder="Tulis jawaban Anda di sini..."
                    className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
                  />
                )}
              </li>
            ))}
          </ol>
        )}

        {!alreadyPassed && data.attemptsRemaining > 0 && (
          <div className="mt-5 flex items-center gap-3">
            <button
              onClick={submit}
              disabled={busy}
              className="rounded-lg bg-emerald-600 px-5 py-2.5 font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {busy ? "Mengirim..." : "Kirim Jawaban"}
            </button>
            <span className="text-xs text-zinc-500">
              Sisa percobaan: {data.attemptsRemaining}
            </span>
          </div>
        )}

        {lastAttempt && data.attempts.length > 0 && (
          <div className="mt-5 border-t border-zinc-800 pt-4">
            <p className="mb-1 text-xs uppercase tracking-wide text-zinc-500">Riwayat</p>
            <ul className="space-y-1 text-sm">
              {data.attempts.map((a) => (
                <li key={a.id} className="flex justify-between text-zinc-400">
                  <span>Percobaan #{a.attemptNumber}</span>
                  <span>
                    {a.score !== null ? `Skor ${a.score}` : "Menunggu review"}
                    {a.passed === true && (
                      <span className="ml-2 text-emerald-400">✓</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
