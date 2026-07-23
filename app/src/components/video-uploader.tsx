"use client";

import { useRef, useState } from "react";

/**
 * Komponen upload video ke Cloudflare Stream (direct upload TUS).
 * Dipakai instruktur di course builder (Tahap C3 akan mengintegrasikannya
 * ke manajemen modul/materi; saat ini dipakai sebagai komponen mandiri).
 *
 * Alur:
 *   1. POST /api/video/upload  → dapat uploadUrl (TUS) + videoId
 *   2. Upload file ke uploadUrl via protokol TUS
 *   3. POST /api/video/confirm → simpan videoId ke lesson
 */
export function VideoUploader({
  lessonId,
  onDone,
}: {
  lessonId: string;
  onDone?: (contentRef: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleUpload() {
    const file = inputRef.current?.files?.[0];
    if (!file) {
      setError("Pilih file video terlebih dahulu");
      return;
    }
    setBusy(true);
    setError(null);
    setProgress(0);

    try {
      // 1. Minta direct-upload URL
      const upRes = await fetch("/api/video/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId, name: file.name }),
      });
      if (!upRes.ok) {
        const j = (await upRes.json()) as { error?: string };
        throw new Error(j.error ?? "Gagal meminta URL upload");
      }
      const { uploadUrl, videoId } = (await upRes.json()) as {
        uploadUrl: string;
        videoId: string;
      };

      // 2. Upload file via TUS (XMLHttpRequest untuk progress)
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", uploadUrl);
        xhr.setRequestHeader("Tus-Resumable", "1.0.0");
        xhr.setRequestHeader("Upload-Length", String(file.size));
        xhr.setRequestHeader(
          "Upload-Metadata",
          `name ${btoa(file.name)},filetype ${btoa(file.type || "video/mp4")}`,
        );
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload gagal (${xhr.status})`)));
        xhr.onerror = () => reject(new Error("Koneksi upload gagal"));
        xhr.send(file);
      });

      // 3. Konfirmasi → simpan videoId ke lesson
      const confRes = await fetch("/api/video/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId, videoId }),
      });
      if (!confRes.ok) {
        const j = (await confRes.json()) as { error?: string };
        throw new Error(j.error ?? "Gagal menyimpan video");
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
      <p className="mb-2 text-sm font-medium text-zinc-200">Upload Video Materi</p>
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        disabled={busy}
        className="mb-3 block w-full text-sm text-zinc-400 file:mr-3 file:rounded-md file:border-0 file:bg-emerald-600 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-emerald-500"
      />
      {busy && (
        <div className="mb-3">
          <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-700">
            <div className="h-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-1 text-xs text-zinc-400">Meng-upload... {progress}%</p>
        </div>
      )}
      {error && (
        <p className="mb-3 rounded border border-red-500/30 bg-red-500/10 px-2 py-1.5 text-xs text-red-400">
          {error}
        </p>
      )}
      {done && (
        <p className="mb-3 rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1.5 text-xs text-emerald-400">
          Video ter-upload dan tersimpan.
        </p>
      )}
      <button
        onClick={handleUpload}
        disabled={busy}
        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
      >
        {busy ? "Meng-upload..." : "Upload Video"}
      </button>
    </div>
  );
}
