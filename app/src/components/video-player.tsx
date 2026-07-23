"use client";

import { useEffect, useState } from "react";

type Playback = {
  hlsUrl: string;
  embedUrl: string;
  thumbnailUrl: string;
  status: "processing" | "ready" | "error";
  durationSeconds: number | null;
};

/**
 * Player video Cloudflare Stream untuk siswa.
 * Mengambil info playback dari /api/video/playback/[lessonId] (yang sudah
 * menegakkan kontrol akses) lalu merender iframe embed Cloudflare Stream.
 */
export function VideoPlayer({ lessonId, title }: { lessonId: string; title: string }) {
  const [data, setData] = useState<Playback | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/video/playback/${lessonId}`);
        const json = (await res.json()) as Playback & { error?: string };
        if (!res.ok) throw new Error(json.error ?? "Gagal memuat video");
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

  if (loading) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-500">
        Memuat video...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-xl border border-red-500/30 bg-red-500/10 px-4 text-center text-sm text-red-400">
        {error}
      </div>
    );
  }

  if (data?.status === "processing") {
    return (
      <div className="flex aspect-video items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-400">
        Video sedang diproses — muat ulang beberapa saat lagi.
      </div>
    );
  }

  return (
    <div className="aspect-video overflow-hidden rounded-xl border border-zinc-800 bg-black">
      <iframe
        src={data?.embedUrl}
        title={title}
        className="h-full w-full"
        allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}
