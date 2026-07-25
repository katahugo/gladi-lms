import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";

import { db } from "@/db";
import { courses } from "@/db/schema";
import { requireInstructor } from "@/lib/guards";
import { CourseForm } from "../../course-form";

export default async function EditCoursePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireInstructor();
  const { id } = await params;

  const course = await db.query.courses.findFirst({ where: eq(courses.id, id) });
  if (!course) notFound();
  if (user.role !== "admin" && course.instructorId !== user.id) notFound();

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-white">Edit Kursus</h1>
        <Link
          href={`/instructor/courses/${id}/curriculum`}
          className="rounded-lg bg-violet-600/20 px-4 py-2 text-sm font-medium text-violet-300 hover:bg-violet-600/30"
        >
          Kelola Kurikulum
        </Link>
      </div>
      <CourseForm course={course} />
    </div>
  );
}
