import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import { db } from "@/db";
import { lessons } from "@/db/schema";
import { VideoPlayer } from "@/components/video-player";

export const dynamic = "force-dynamic";

/**
 * Halaman demo player video — untuk menguji integrasi Cloudflare Stream (C2)
 * sebelum halaman belajar penuh dibangun di C3.
 * Akses tetap ditegakkan oleh /api/video/playback (free preview / enrollment).
 */
export default async function LessonDemoPage({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}) {
  const { lessonId } = await params;
  const lesson = await db.query.lessons.findFirst({ where: eq(lessons.id, lessonId) });
  if (!lesson) notFound();

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="mb-2 text-2xl font-bold text-white">{lesson.title}</h1>
      <p className="mb-6 text-sm text-zinc-500">
        Demo player video (C2). Integrasi ke halaman belajar penuh ada di C3.
      </p>
      {lesson.type === "video" && lesson.contentRef?.startsWith("cf:") ? (
        <VideoPlayer lessonId={lesson.id} title={lesson.title} />
      ) : (
        <p className="rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-center text-zinc-500">
          Lesson ini belum punya video. Upload via komponen VideoUploader.
        </p>
      )}
    </div>
  );
}
