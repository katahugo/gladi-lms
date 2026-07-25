"use client";

import { useEffect, useState } from "react";

type QuestionType = "multiple_choice" | "true_false" | "essay";

type Option = { id: string; text: string };

type DraftQuestion = {
  key: string;
  question: string;
  type: QuestionType;
  options: Option[];
  correctAnswer: string | null;
  points: number;
};

function newKey() {
  return `q-${Math.random().toString(36).slice(2, 9)}`;
}

function emptyQuestion(type: QuestionType = "multiple_choice"): DraftQuestion {
  if (type === "true_false") {
    return {
      key: newKey(),
      question: "",
      type,
      options: [],
      correctAnswer: "true",
      points: 1,
    };
  }
  if (type === "essay") {
    return {
      key: newKey(),
      question: "",
      type,
      options: [],
      correctAnswer: null,
      points: 1,
    };
  }
  return {
    key: newKey(),
    question: "",
    type: "multiple_choice",
    options: [
      { id: "a", text: "" },
      { id: "b", text: "" },
    ],
    correctAnswer: "a",
    points: 1,
  };
}

/**
 * UI authoring kuis untuk instruktur (PRD §13 F1).
 * Menyimpan via POST /api/instructor/quizzes/[lessonId].
 */
export function QuizBuilder({ lessonId }: { lessonId: string }) {
  const [passingScore, setPassingScore] = useState(70);
  const [maxAttempts, setMaxAttempts] = useState(3);
  const [questions, setQuestions] = useState<DraftQuestion[]>([emptyQuestion()]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/quizzes/${lessonId}`);
        if (res.status === 404) {
          if (!cancelled) setQuestions([emptyQuestion()]);
          return;
        }
        if (!res.ok) throw new Error("Gagal memuat kuis");
        const data = (await res.json()) as {
          quiz: { passingScore: number; maxAttempts: number };
          questions: Array<{
            question: string;
            type: QuestionType;
            options: Option[] | null;
            correctAnswer?: string | null;
            points: number;
          }>;
        };
        if (cancelled) return;
        setPassingScore(data.quiz.passingScore);
        setMaxAttempts(data.quiz.maxAttempts);
        setQuestions(
          data.questions.length
            ? data.questions.map((q) => ({
                key: newKey(),
                question: q.question,
                type: q.type,
                options:
                  q.type === "multiple_choice"
                    ? q.options ?? [
                        { id: "a", text: "" },
                        { id: "b", text: "" },
                      ]
                    : [],
                correctAnswer: q.correctAnswer ?? (q.type === "true_false" ? "true" : null),
                points: q.points,
              }))
            : [emptyQuestion()],
        );
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Gagal memuat");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lessonId]);

  async function save() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/instructor/quizzes/${lessonId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          passingScore,
          maxAttempts,
          questions: questions.map((q) => ({
            question: q.question,
            type: q.type,
            options: q.type === "multiple_choice" ? q.options : undefined,
            correctAnswer: q.type === "essay" ? null : q.correctAnswer,
            points: q.points,
          })),
        }),
      });
      if (!res.ok) {
        const j = (await res.json()) as { error?: string };
        throw new Error(j.error ?? "Gagal menyimpan kuis");
      }
      setMessage("Kuis tersimpan");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-zinc-500">Memuat kuis…</p>;
  }

  return (
    <div className="space-y-4 rounded-lg border border-zinc-700 bg-zinc-800/40 p-4">
      <div className="flex flex-wrap items-end gap-4">
        <label className="text-sm text-zinc-300">
          Passing score (%)
          <input
            type="number"
            min={0}
            max={100}
            value={passingScore}
            onChange={(e) => setPassingScore(Number(e.target.value))}
            className="mt-1 block w-28 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-white"
          />
        </label>
        <label className="text-sm text-zinc-300">
          Max attempts
          <input
            type="number"
            min={1}
            max={20}
            value={maxAttempts}
            onChange={(e) => setMaxAttempts(Number(e.target.value))}
            className="mt-1 block w-28 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-white"
          />
        </label>
      </div>

      <ul className="space-y-4">
        {questions.map((q, qi) => (
          <li key={q.key} className="rounded-md border border-zinc-700 bg-zinc-950/60 p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Soal {qi + 1}
              </p>
              <div className="flex items-center gap-2">
                <select
                  value={q.type}
                  onChange={(e) => {
                    const type = e.target.value as QuestionType;
                    setQuestions((prev) =>
                      prev.map((item, i) => (i === qi ? emptyQuestion(type) : item)),
                    );
                  }}
                  className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200"
                >
                  <option value="multiple_choice">Pilihan ganda</option>
                  <option value="true_false">Benar / Salah</option>
                  <option value="essay">Essay</option>
                </select>
                <button
                  type="button"
                  onClick={() => setQuestions((prev) => prev.filter((_, i) => i !== qi))}
                  disabled={questions.length <= 1}
                  className="text-xs text-red-400 hover:underline disabled:opacity-40"
                >
                  Hapus
                </button>
              </div>
            </div>

            <textarea
              value={q.question}
              onChange={(e) =>
                setQuestions((prev) =>
                  prev.map((item, i) => (i === qi ? { ...item, question: e.target.value } : item)),
                )
              }
              rows={2}
              placeholder="Teks pertanyaan"
              className="mb-2 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white"
            />

            {q.type === "multiple_choice" && (
              <div className="space-y-2">
                {q.options.map((opt, oi) => (
                  <div key={opt.id} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`correct-${q.key}`}
                      checked={q.correctAnswer === opt.id}
                      onChange={() =>
                        setQuestions((prev) =>
                          prev.map((item, i) =>
                            i === qi ? { ...item, correctAnswer: opt.id } : item,
                          ),
                        )
                      }
                    />
                    <input
                      value={opt.text}
                      onChange={(e) =>
                        setQuestions((prev) =>
                          prev.map((item, i) => {
                            if (i !== qi) return item;
                            const options = item.options.map((o, j) =>
                              j === oi ? { ...o, text: e.target.value } : o,
                            );
                            return { ...item, options };
                          }),
                        )
                      }
                      placeholder={`Opsi ${opt.id}`}
                      className="flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-white"
                    />
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setQuestions((prev) =>
                      prev.map((item, i) => {
                        if (i !== qi) return item;
                        const nextId = String.fromCharCode(97 + item.options.length);
                        return {
                          ...item,
                          options: [...item.options, { id: nextId, text: "" }],
                        };
                      }),
                    )
                  }
                  className="text-xs text-emerald-400 hover:underline"
                >
                  + Opsi
                </button>
              </div>
            )}

            {q.type === "true_false" && (
              <select
                value={q.correctAnswer ?? "true"}
                onChange={(e) =>
                  setQuestions((prev) =>
                    prev.map((item, i) =>
                      i === qi ? { ...item, correctAnswer: e.target.value } : item,
                    ),
                  )
                }
                className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-200"
              >
                <option value="true">Benar</option>
                <option value="false">Salah</option>
              </select>
            )}

            {q.type === "essay" && (
              <p className="text-xs text-zinc-500">Essay dinilai manual oleh instruktur.</p>
            )}

            <label className="mt-2 block text-xs text-zinc-400">
              Poin
              <input
                type="number"
                min={1}
                value={q.points}
                onChange={(e) =>
                  setQuestions((prev) =>
                    prev.map((item, i) =>
                      i === qi ? { ...item, points: Number(e.target.value) || 1 } : item,
                    ),
                  )
                }
                className="ml-2 w-16 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-white"
              />
            </label>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setQuestions((prev) => [...prev, emptyQuestion()])}
          className="rounded-md bg-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-100 hover:bg-zinc-600"
        >
          + Soal
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {saving ? "Menyimpan…" : "Simpan Kuis"}
        </button>
        {message && <span className="text-xs text-emerald-400">{message}</span>}
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>
    </div>
  );
}
