"use client";

import Link from "next/link";
import { useTransition } from "react";

import { setCourseStatus, deleteCourse } from "./actions";

export function CourseRowActions({
  id,
  status,
}: {
  id: string;
  status: "draft" | "published" | "archived";
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status !== "published" && (
        <button
          onClick={() =>
            startTransition(async () => {
              const result = await setCourseStatus(id, "published");
              if (result?.error) alert(result.error);
            })
          }
          disabled={pending}
          className="rounded-md bg-emerald-600/20 px-3 py-1.5 text-xs font-medium text-emerald-400 hover:bg-emerald-600/30 disabled:opacity-50"
        >
          Terbitkan
        </button>
      )}
      {status === "published" && (
        <button
          onClick={() =>
            startTransition(async () => {
              await setCourseStatus(id, "draft");
            })
          }
          disabled={pending}
          className="rounded-md bg-zinc-600/30 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-600/50 disabled:opacity-50"
        >
          Jadikan Draft
        </button>
      )}
      <Link
        href={`/instructor/courses/${id}/curriculum`}
        className="rounded-md bg-violet-600/20 px-3 py-1.5 text-xs font-medium text-violet-300 hover:bg-violet-600/30"
      >
        Kurikulum
      </Link>
      <Link
        href={`/instructor/courses/${id}/edit`}
        className="rounded-md bg-sky-600/20 px-3 py-1.5 text-xs font-medium text-sky-400 hover:bg-sky-600/30"
      >
        Edit
      </Link>
      <Link
        href={`/instructor/courses/${id}/students`}
        className="rounded-md bg-zinc-600/30 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-600/50"
      >
        Siswa
      </Link>
      <button
        onClick={() => {
          if (confirm("Hapus kursus ini beserta seluruh modul & materinya?")) {
            startTransition(() => deleteCourse(id));
          }
        }}
        disabled={pending}
        className="rounded-md bg-red-600/20 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-600/30 disabled:opacity-50"
      >
        Hapus
      </button>
    </div>
  );
}
