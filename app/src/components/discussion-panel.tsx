"use client";

import { useEffect, useState } from "react";

type Row = {
  id: string;
  parentId: string | null;
  body: string;
  isResolved: boolean;
  createdAt: string;
  userId: string;
  userName: string | null;
  userRole: "student" | "instructor" | "admin" | "support";
};

/**
 * Panel diskusi per-lesson (E2). Menampilkan thread + balasan, form tulis,
 * tombol hapus (untuk yang berhak), dan tanda "instruktur" untuk peran.
 */
export function DiscussionPanel({ lessonId }: { lessonId: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [canWrite, setCanWrite] = useState(true);

  async function load() {
    try {
      const res = await fetch(`/api/discussions?lessonId=${lessonId}`);
      const json = (await res.json()) as { discussions: Row[] };
      setRows(json.discussions ?? []);
    } catch {
      setError("Gagal memuat diskusi");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/discussions?lessonId=${lessonId}`);
        const json = (await res.json()) as { discussions: Row[] };
        if (!cancelled) setRows(json.discussions ?? []);
      } catch {
        if (!cancelled) setError("Gagal memuat diskusi");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lessonId]);

  async function submit(text: string, parentId: string | null) {
    if (text.trim().length < 2) {
      setError("Isi minimal 2 karakter");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/discussions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId, body: text, parentId }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        if (res.status === 403) setCanWrite(false);
        throw new Error(json.error ?? "Gagal mengirim");
      }
      if (parentId) {
        setReplyTo(null);
        setReplyText("");
      } else {
        setBody("");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Hapus komentar ini?")) return;
    const res = await fetch(`/api/discussions/${id}`, { method: "DELETE" });
    if (res.ok) await load();
  }

  async function toggleResolved(id: string, next: boolean) {
    const res = await fetch(`/api/discussions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isResolved: next }),
    });
    if (res.ok) await load();
  }

  if (loading) {
    return <p className="text-sm text-zinc-500">Memuat diskusi...</p>;
  }

  const roots = rows.filter((r) => r.parentId === null);
  const repliesOf = (rootId: string) => rows.filter((r) => r.parentId === rootId);

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-white">Diskusi ({rows.length})</h3>

      {/* Form thread baru */}
      {canWrite ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
          <textarea
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Ajukan pertanyaan atau bagikan pemikiran..."
            className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
          />
          {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
          <button
            onClick={() => submit(body, null)}
            disabled={busy}
            className="mt-2 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {busy ? "Mengirim..." : "Kirim"}
          </button>
        </div>
      ) : (
        <p className="rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-sm text-zinc-500">
          Anda perlu terdaftar di kursus ini untuk ikut diskusi.
        </p>
      )}

      {/* Daftar thread */}
      {roots.length === 0 ? (
        <p className="text-sm text-zinc-500">Belum ada diskusi. Jadilah yang pertama bertanya.</p>
      ) : (
        <ul className="space-y-3">
          {roots.map((r) => (
            <li key={r.id} className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-medium text-zinc-200">{r.userName ?? "Anon"}</span>
                <RoleBadge role={r.userRole} />
                <span className="text-zinc-500">
                  {new Date(r.createdAt).toLocaleString("id-ID")}
                </span>
                {r.isResolved && (
                  <span className="rounded bg-emerald-600/20 px-1.5 py-0.5 text-emerald-400">
                    ✓ Terselesaikan
                  </span>
                )}
              </div>
              <p className="mt-1 whitespace-pre-line text-sm text-zinc-200">{r.body}</p>

              <div className="mt-2 flex flex-wrap gap-2">
                {canWrite && (
                  <button
                    onClick={() => {
                      setReplyTo(replyTo === r.id ? null : r.id);
                      setReplyText("");
                    }}
                    className="text-xs text-emerald-400 hover:underline"
                  >
                    {replyTo === r.id ? "Batal" : "Balas"}
                  </button>
                )}
                <button
                  onClick={() => toggleResolved(r.id, !r.isResolved)}
                  className="text-xs text-zinc-500 hover:text-zinc-300"
                >
                  {r.isResolved ? "Buka lagi" : "Tandai selesai"}
                </button>
                <button
                  onClick={() => remove(r.id)}
                  className="text-xs text-red-400 hover:underline"
                >
                  Hapus
                </button>
              </div>

              {/* Form balasan */}
              {replyTo === r.id && (
                <div className="mt-3 border-t border-zinc-800 pt-3">
                  <textarea
                    rows={2}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Tulis balasan..."
                    className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-sm text-white outline-none focus:border-emerald-500"
                  />
                  <button
                    onClick={() => submit(replyText, r.id)}
                    disabled={busy}
                    className="mt-1.5 rounded-md bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                  >
                    Kirim Balasan
                  </button>
                </div>
              )}

              {/* Balasan */}
              {repliesOf(r.id).length > 0 && (
                <ul className="mt-3 space-y-2 border-l-2 border-zinc-800 pl-3">
                  {repliesOf(r.id).map((c) => (
                    <li key={c.id}>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-medium text-zinc-300">{c.userName ?? "Anon"}</span>
                        <RoleBadge role={c.userRole} />
                        <span className="text-zinc-500">
                          {new Date(c.createdAt).toLocaleString("id-ID")}
                        </span>
                      </div>
                      <p className="mt-0.5 whitespace-pre-line text-sm text-zinc-300">{c.body}</p>
                      <button
                        onClick={() => remove(c.id)}
                        className="mt-0.5 text-[10px] text-red-400 hover:underline"
                      >
                        hapus
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  if (role === "instructor") {
    return (
      <span className="rounded bg-sky-600/20 px-1.5 py-0.5 text-[10px] font-medium text-sky-400">
        Instruktur
      </span>
    );
  }
  if (role === "admin") {
    return (
      <span className="rounded bg-red-600/20 px-1.5 py-0.5 text-[10px] font-medium text-red-400">
        Admin
      </span>
    );
  }
  if (role === "support") {
    return (
      <span className="rounded bg-amber-600/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
        Support
      </span>
    );
  }
  return null;
}
