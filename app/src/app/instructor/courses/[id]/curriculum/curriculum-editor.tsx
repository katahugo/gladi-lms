"use client";

import { useCallback, useState } from "react";

import { MaterialUploader } from "@/components/material-uploader";
import { QuizBuilder } from "@/components/quiz-builder";
import { VideoUploader } from "@/components/video-uploader";
import { readJson } from "@/lib/api-client";

export type CurriculumLesson = {
  id: string;
  moduleId: string;
  title: string;
  type: "video" | "text" | "quiz" | "assignment";
  contentRef: string | null;
  contentBody: string | null;
  sortOrder: number;
  isFreePreview: boolean;
};

export type CurriculumModule = {
  id: string;
  courseId: string;
  title: string;
  sortOrder: number;
  lessons: CurriculumLesson[];
};

const TYPE_LABEL: Record<CurriculumLesson["type"], string> = {
  video: "Video",
  text: "Teks / File",
  quiz: "Kuis",
  assignment: "Tugas",
};

async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = await readJson<T & { error?: string }>(res);
  if (!res.ok) throw new Error(data.error ?? `Request gagal (${res.status})`);
  return data;
}

export function CurriculumEditor({
  courseId,
  courseTitle,
  initialModules,
}: {
  courseId: string;
  courseTitle: string;
  initialModules: CurriculumModule[];
}) {
  const [modules, setModules] = useState(initialModules);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(
    initialModules[0]?.lessons[0]?.id ?? null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newModuleTitle, setNewModuleTitle] = useState("");

  const selected = modules
    .flatMap((m) => m.lessons.map((l) => ({ module: m, lesson: l })))
    .find((x) => x.lesson.id === selectedLessonId);

  const reload = useCallback(async () => {
    const data = await apiJson<{ modules: CurriculumModule[] }>(
      `/api/instructor/courses/${courseId}/modules`,
    );
    setModules(data.modules);
    return data.modules;
  }, [courseId]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setBusy(false);
    }
  }

  async function addModule() {
    await run(async () => {
      const title = newModuleTitle.trim() || `Modul ${modules.length + 1}`;
      await apiJson(`/api/instructor/courses/${courseId}/modules`, {
        method: "POST",
        body: JSON.stringify({ title }),
      });
      setNewModuleTitle("");
      await reload();
    });
  }

  async function renameModule(moduleId: string, title: string) {
    await run(async () => {
      await apiJson(`/api/instructor/modules/${moduleId}`, {
        method: "PATCH",
        body: JSON.stringify({ title }),
      });
      await reload();
    });
  }

  async function moveModule(moduleId: string, direction: "up" | "down") {
    await run(async () => {
      await apiJson(`/api/instructor/modules/${moduleId}`, {
        method: "PATCH",
        body: JSON.stringify({ direction }),
      });
      await reload();
    });
  }

  async function deleteModule(moduleId: string) {
    if (!confirm("Hapus modul ini beserta seluruh materinya?")) return;
    await run(async () => {
      await apiJson(`/api/instructor/modules/${moduleId}`, { method: "DELETE" });
      const next = await reload();
      if (selectedLessonId && !next.some((m) => m.lessons.some((l) => l.id === selectedLessonId))) {
        setSelectedLessonId(next[0]?.lessons[0]?.id ?? null);
      }
    });
  }

  async function addLesson(moduleId: string, type: CurriculumLesson["type"]) {
    await run(async () => {
      const data = await apiJson<{ lesson: CurriculumLesson }>(
        `/api/instructor/modules/${moduleId}/lessons`,
        {
          method: "POST",
          body: JSON.stringify({ title: `Materi baru (${TYPE_LABEL[type]})`, type }),
        },
      );
      await reload();
      setSelectedLessonId(data.lesson.id);
    });
  }

  async function patchLesson(lessonId: string, patch: Record<string, unknown>) {
    await run(async () => {
      await apiJson(`/api/instructor/lessons/${lessonId}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      await reload();
    });
  }

  async function moveLesson(lessonId: string, direction: "up" | "down") {
    await run(async () => {
      await apiJson(`/api/instructor/lessons/${lessonId}`, {
        method: "PATCH",
        body: JSON.stringify({ direction }),
      });
      await reload();
    });
  }

  async function deleteLesson(lessonId: string) {
    if (!confirm("Hapus materi ini?")) return;
    await run(async () => {
      await apiJson(`/api/instructor/lessons/${lessonId}`, { method: "DELETE" });
      const next = await reload();
      if (selectedLessonId === lessonId) {
        setSelectedLessonId(next[0]?.lessons[0]?.id ?? null);
      }
    });
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-6">
        <p className="text-xs uppercase tracking-wide text-zinc-500">Kurikulum</p>
        <h1 className="text-2xl font-bold text-white">{courseTitle}</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Susun modul & materi, unggah video/file, dan buat kuis sebelum menerbitkan kursus.
        </p>
      </div>

      {error && (
        <p className="mb-4 rounded-md border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* Tree */}
        <aside className="space-y-3">
          <div className="flex gap-2">
            <input
              value={newModuleTitle}
              onChange={(e) => setNewModuleTitle(e.target.value)}
              placeholder="Judul modul baru"
              className="flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white"
            />
            <button
              type="button"
              disabled={busy}
              onClick={addModule}
              className="rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              + Modul
            </button>
          </div>

          {modules.length === 0 ? (
            <p className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-500">
              Belum ada modul. Tambahkan modul pertama untuk mulai menyusun materi.
            </p>
          ) : (
            <ul className="space-y-3">
              {modules.map((mod, mi) => (
                <li key={mod.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <input
                      defaultValue={mod.title}
                      onBlur={(e) => {
                        if (e.target.value.trim() && e.target.value !== mod.title) {
                          void renameModule(mod.id, e.target.value.trim());
                        }
                      }}
                      className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-sm font-semibold text-white hover:border-zinc-700 focus:border-zinc-600"
                    />
                    <div className="flex shrink-0 gap-1">
                      <IconBtn disabled={busy || mi === 0} onClick={() => moveModule(mod.id, "up")} label="↑" />
                      <IconBtn
                        disabled={busy || mi === modules.length - 1}
                        onClick={() => moveModule(mod.id, "down")}
                        label="↓"
                      />
                      <IconBtn disabled={busy} onClick={() => deleteModule(mod.id)} label="✕" danger />
                    </div>
                  </div>

                  <ul className="space-y-1">
                    {mod.lessons.map((lesson, li) => (
                      <li key={lesson.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedLessonId(lesson.id)}
                          className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm ${
                            selectedLessonId === lesson.id
                              ? "bg-emerald-600/20 text-emerald-300"
                              : "text-zinc-300 hover:bg-zinc-800"
                          }`}
                        >
                          <span className="truncate">{lesson.title}</span>
                          <span className="ml-2 shrink-0 text-[10px] uppercase text-zinc-500">
                            {TYPE_LABEL[lesson.type]}
                          </span>
                        </button>
                        <div className="mb-1 flex justify-end gap-1 px-1">
                          <IconBtn
                            disabled={busy || li === 0}
                            onClick={() => moveLesson(lesson.id, "up")}
                            label="↑"
                          />
                          <IconBtn
                            disabled={busy || li === mod.lessons.length - 1}
                            onClick={() => moveLesson(lesson.id, "down")}
                            label="↓"
                          />
                        </div>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-2 flex flex-wrap gap-1">
                    {(["video", "text", "quiz", "assignment"] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        disabled={busy}
                        onClick={() => addLesson(mod.id, t)}
                        className="rounded bg-zinc-800 px-2 py-1 text-[10px] text-zinc-300 hover:bg-zinc-700 disabled:opacity-50"
                      >
                        + {TYPE_LABEL[t]}
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </aside>

        {/* Detail */}
        <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          {!selected ? (
            <p className="text-sm text-zinc-500">Pilih materi di kiri untuk mengedit kontennya.</p>
          ) : (
            <LessonDetail
              key={selected.lesson.id}
              lesson={selected.lesson}
              busy={busy}
              onPatch={(patch) => patchLesson(selected.lesson.id, patch)}
              onDelete={() => deleteLesson(selected.lesson.id)}
              onContentUploaded={async () => {
                await reload();
              }}
            />
          )}
        </section>
      </div>
    </div>
  );
}

function LessonDetail({
  lesson,
  busy,
  onPatch,
  onDelete,
  onContentUploaded,
}: {
  lesson: CurriculumLesson;
  busy: boolean;
  onPatch: (patch: Record<string, unknown>) => Promise<void>;
  onDelete: () => void;
  onContentUploaded: () => Promise<void>;
}) {
  const [title, setTitle] = useStateLocal(lesson.title);
  const [body, setBody] = useStateLocal(lesson.contentBody ?? "");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex-1">
          <label className="text-xs text-zinc-500">Judul materi</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              if (title.trim() && title.trim() !== lesson.title) {
                void onPatch({ title: title.trim() });
              }
            }}
            className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-medium text-white"
          />
        </div>
        <div>
          <label className="text-xs text-zinc-500">Tipe</label>
          <select
            value={lesson.type}
            disabled={busy}
            onChange={(e) => onPatch({ type: e.target.value })}
            className="mt-1 block rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
          >
            <option value="video">Video</option>
            <option value="text">Teks / File</option>
            <option value="quiz">Kuis</option>
            <option value="assignment">Tugas</option>
          </select>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-zinc-300">
        <input
          type="checkbox"
          checked={lesson.isFreePreview}
          disabled={busy}
          onChange={(e) => onPatch({ isFreePreview: e.target.checked })}
        />
        Free preview (bisa dilihat tanpa enrollment)
      </label>

      {lesson.type === "video" && (
        <div className="space-y-2">
          <p className="text-sm text-zinc-400">
            Referensi:{" "}
            <code className="text-xs text-zinc-300">{lesson.contentRef ?? "belum diunggah"}</code>
          </p>
          <VideoUploader lessonId={lesson.id} onDone={() => void onContentUploaded()} />
        </div>
      )}

      {lesson.type === "text" && (
        <div className="space-y-4">
          <div>
            <label className="text-xs text-zinc-500">Konten teks (markdown/plain)</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onBlur={() => {
                if (body !== (lesson.contentBody ?? "")) {
                  void onPatch({ contentBody: body });
                }
              }}
              rows={8}
              className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
              placeholder="Tulis materi teks di sini…"
            />
          </div>
          <div>
            <p className="mb-2 text-xs text-zinc-500">
              Opsional: lampirkan file (PDF/dokumen) — disimpan ke{" "}
              <code className="text-zinc-400">{lesson.contentRef ?? "—"}</code>
            </p>
            <MaterialUploader lessonId={lesson.id} onDone={() => void onContentUploaded()} />
          </div>
        </div>
      )}

      {lesson.type === "quiz" && <QuizBuilder lessonId={lesson.id} />}

      {lesson.type === "assignment" && (
        <div className="space-y-2">
          <p className="text-sm text-zinc-400">
            Unggah rubrik/instruksi tugas. Pengumpulan tugas siswa akan ditambahkan di fase berikutnya.
          </p>
          <p className="text-xs text-zinc-500">
            Ref: <code>{lesson.contentRef ?? "belum diunggah"}</code>
          </p>
          <MaterialUploader lessonId={lesson.id} onDone={() => void onContentUploaded()} />
        </div>
      )}

      <button
        type="button"
        disabled={busy}
        onClick={onDelete}
        className="rounded-md bg-red-600/20 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-600/30 disabled:opacity-50"
      >
        Hapus materi
      </button>
    </div>
  );
}

function useStateLocal(initial: string) {
  const [value, setValue] = useState(initial);
  return [value, setValue] as const;
}

function IconBtn({
  label,
  onClick,
  disabled,
  danger,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded px-1.5 py-0.5 text-xs disabled:opacity-30 ${
        danger ? "text-red-400 hover:bg-red-950/40" : "text-zinc-400 hover:bg-zinc-800"
      }`}
    >
      {label}
    </button>
  );
}
