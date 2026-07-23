import { eq } from "drizzle-orm";
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
      <h1 className="mb-8 text-2xl font-bold text-white">Edit Kursus</h1>
      <CourseForm course={course} />
    </div>
  );
}
