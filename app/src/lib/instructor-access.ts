import { eq } from "drizzle-orm";

import { db } from "@/db";
import { courses, lessons, modules } from "@/db/schema";

type Actor = { id: string; role: string };

/**
 * Pastikan aktor adalah pemilik kursus atau admin.
 * Mengembalikan row kursus jika OK; null jika tidak ditemukan / tidak berhak.
 */
export async function getOwnedCourse(courseId: string, actor: Actor) {
  const course = await db.query.courses.findFirst({ where: eq(courses.id, courseId) });
  if (!course) return null;
  if (actor.role !== "admin" && course.instructorId !== actor.id) return null;
  return course;
}

/** Resolusi lesson → module → course + cek ownership. */
export async function getOwnedLessonContext(lessonId: string, actor: Actor) {
  const lesson = await db.query.lessons.findFirst({ where: eq(lessons.id, lessonId) });
  if (!lesson) return null;
  const mod = await db.query.modules.findFirst({ where: eq(modules.id, lesson.moduleId) });
  if (!mod) return null;
  const course = await getOwnedCourse(mod.courseId, actor);
  if (!course) return null;
  return { lesson, module: mod, course };
}

/** Resolusi module → course + cek ownership. */
export async function getOwnedModuleContext(moduleId: string, actor: Actor) {
  const mod = await db.query.modules.findFirst({ where: eq(modules.id, moduleId) });
  if (!mod) return null;
  const course = await getOwnedCourse(mod.courseId, actor);
  if (!course) return null;
  return { module: mod, course };
}
