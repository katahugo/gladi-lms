"use client";

import { useRef, useState } from "react";

import { readJson } from "@/lib/api-client";

/**
 * Upload materi ke MinIO via proxy API app (bukan signed URL langsung).
 * Alur: POST multipart /api/material/upload → simpan contentRef di lesson.
 *
 * Catatan: browser tidak bisa menjangkau MinIO internal (http://minio:9000),
 * jadi upload harus lewat Next.js API.
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
    setDone(false);

    try {
      const form = new FormData();
      form.set("lessonId", lessonId);
      form.set("file", file);

      const res = await fetch("/api/material/upload", {
        method: "POST",
        body: form,
        credentials: "same-origin",
      });
      const data = await readJson<{ error?: string; contentRef?: string }>(res);
      if (!res.ok) {
        throw new Error(data.error ?? "Gagal meng-upload materi");
      }
      if (!data.contentRef) {
        throw new Error("Upload berhasil tetapi contentRef kosong");
      }

      setDone(true);
      onDone?.(data.contentRef);
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
