"use client";

import { useRef, useState } from "react";

/**
 * Komponen upload materi (PDF/gambar/dokumen) ke MinIO via signed URL.
 * Alur:
 *   1. POST /api/material/upload-url → dapat uploadUrl (PUT) + key
 *   2. PUT file langsung ke MinIO via signed URL
 *   3. POST /api/material/confirm → simpan key ke lesson
 */
export function MaterialUploader({
  lessonId,
  onDone,
}: {
  lessonId: string;
  onDone?: (contentRef: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleUpload() {
    const file = inputRef.current?.files?.[0];
    if (!file) {
      setError("Pilih file materi terlebih dahulu");
      return;
    }
    setBusy(true);
    setError(null);

    try {
      // 1. Minta signed URL upload
      const upRes = await fetch("/api/material/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId, filename: file.name, contentType: file.type }),
      });
      if (!upRes.ok) {
        const j = (await upRes.json()) as { error?: string };
        throw new Error(j.error ?? "Gagal meminta URL upload");
      }
      const { uploadUrl, key } = (await upRes.json()) as { uploadUrl: string; key: string };

      // 2. PUT file langsung ke MinIO via signed URL
      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!putRes.ok) throw new Error(`Upload ke storage gagal (${putRes.status})`);

      // 3. Konfirmasi simpan key ke lesson
      const confRes = await fetch("/api/material/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId, key }),
      });
      if (!confRes.ok) {
        const j = (await confRes.json()) as { error?: string };
        throw new Error(j.error ?? "Gagal menyimpan materi");
      }
      const conf = (await confRes.json()) as { contentRef: string };

      setDone(true);
      onDone?.(conf.contentRef);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-4">
      <p className="mb-2 text-sm font-medium text-zinc-200">Upload Materi (PDF/Gambar/Dokumen)</p>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,.webp,.zip,.txt,.docx,.xlsx"
        disabled={busy}
        className="mb-3 block w-full text-sm text-zinc-400 file:mr-3 file:rounded-md file:border-0 file:bg-emerald-600 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-emerald-500"
      />
      {error && (
        <p className="mb-3 rounded border border-red-500/30 bg-red-500/10 px-2 py-1.5 text-xs text-red-400">
          {error}
        </p>
      )}
      {done && (
        <p className="mb-3 rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1.5 text-xs text-emerald-400">
          Materi ter-upload dan tersimpan.
        </p>
      )}
      <button
        onClick={handleUpload}
        disabled={busy}
        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
      >
        {busy ? "Meng-upload..." : "Upload Materi"}
      </button>
    </div>
  );
}
