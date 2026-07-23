"use client";

import { useActionState } from "react";
import { createCourse, updateCourse, type CourseFormState } from "./actions";

const initial: CourseFormState = {};

export function CourseForm({
  course,
}: {
  course?: { id: string; title: string; description: string | null; category: string | null; price: number };
}) {
  const action = course
    ? updateCourse.bind(null, course.id)
    : createCourse;
  const [state, formAction, pending] = useActionState(action, initial);

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-4">
      {state.error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {state.error}
        </p>
      )}

      <label className="flex flex-col gap-1.5 text-sm text-zinc-300">
        Judul Kursus *
        <input
          name="title"
          required
          minLength={3}
          defaultValue={course?.title}
          className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white outline-none focus:border-emerald-500"
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm text-zinc-300">
        Deskripsi
        <textarea
          name="description"
          rows={5}
          defaultValue={course?.description ?? ""}
          className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white outline-none focus:border-emerald-500"
        />
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1.5 text-sm text-zinc-300">
          Kategori
          <input
            name="category"
            defaultValue={course?.category ?? ""}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white outline-none focus:border-emerald-500"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm text-zinc-300">
          Harga (Rp)
          <input
            name="price"
            inputMode="numeric"
            defaultValue={course?.price ?? 0}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white outline-none focus:border-emerald-500"
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-lg bg-emerald-600 px-4 py-2.5 font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
      >
        {pending ? "Menyimpan..." : course ? "Simpan Perubahan" : "Buat Kursus (Draft)"}
      </button>
    </form>
  );
}
