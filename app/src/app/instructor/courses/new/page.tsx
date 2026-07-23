import { requireInstructor } from "@/lib/guards";
import { CourseForm } from "../course-form";

export default async function NewCoursePage() {
  await requireInstructor();

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="mb-8 text-2xl font-bold text-white">Buat Kursus Baru</h1>
      <CourseForm />
    </div>
  );
}
