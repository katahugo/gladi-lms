"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { deleteCourse } from "@/app/instructor/courses/actions";

type AdminCourseRowActionsProps = {
  id: string;
  slug: string | null;
  status: "draft" | "published" | "archived";
};

/**
 * Aksi baris tabel manajemen kursus admin: lihat, edit, hapus.
 */
export function AdminCourseRowActions({ id, slug, status }: AdminCourseRowActionsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const canView = status === "published" && Boolean(slug);

  return (
    <div className="flex items-center justify-end gap-2">
      {canView ? (
        <Link
          href={`/courses/${slug}`}
          className="rounded p-1.5 text-on-surface-variant transition-all hover:bg-primary-container/20 hover:text-primary"
          title="Lihat"
        >
          <span className="material-symbols-outlined text-[20px]">visibility</span>
        </Link>
      ) : (
        <span
          className="cursor-not-allowed rounded p-1.5 text-on-surface-variant opacity-40"
          title="Belum dipublikasikan"
        >
          <span className="material-symbols-outlined text-[20px]">visibility</span>
        </span>
      )}
      <Link
        href={`/instructor/courses/${id}/edit`}
        className="rounded p-1.5 text-on-surface-variant transition-all hover:bg-tertiary-container/20 hover:text-tertiary"
        title="Edit"
      >
        <span className="material-symbols-outlined text-[20px]">edit</span>
      </Link>
      <button
        type="button"
        disabled={pending}
        title="Hapus"
        className="rounded p-1.5 text-on-surface-variant transition-all hover:bg-error-container/20 hover:text-error disabled:opacity-50"
        onClick={() => {
          if (!confirm("Hapus kursus ini beserta seluruh modul & materinya?")) return;
          startTransition(async () => {
            await deleteCourse(id);
            router.refresh();
          });
        }}
      >
        <span className="material-symbols-outlined text-[20px]">delete</span>
      </button>
    </div>
  );
}
