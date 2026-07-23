"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, ne } from "drizzle-orm";

import { db } from "@/db";
import { courses } from "@/db/schema";
import { requireInstructor } from "@/lib/guards";
import { slugify } from "@/lib/courses";

export type CourseFormState = { error?: string };

async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  const root = slugify(base) || "kursus";
  let candidate = root;
  let n = 1;
  // Pastikan slug unik — tambah suffix angka bila sudah dipakai
  while (true) {
    const clash = await db.query.courses.findFirst({
      where: excludeId
        ? and(eq(courses.slug, candidate), ne(courses.id, excludeId))
        : eq(courses.slug, candidate),
    });
    if (!clash) return candidate;
    n += 1;
    candidate = `${root}-${n}`;
  }
}

function parseCourseForm(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const priceRaw = String(formData.get("price") ?? "0").replace(/[^\d]/g, "");
  const price = Number(priceRaw || "0");

  if (title.length < 3) return { error: "Judul minimal 3 karakter" } as const;
  if (!Number.isInteger(price) || price < 0) return { error: "Harga tidak valid" } as const;
  return { title, description, category, price } as const;
}

export async function createCourse(
  _prev: CourseFormState,
  formData: FormData,
): Promise<CourseFormState> {
  const user = await requireInstructor();
  const parsed = parseCourseForm(formData);
  if ("error" in parsed) return { error: parsed.error };

  const slug = await uniqueSlug(parsed.title);
  await db.insert(courses).values({
    instructorId: user.id,
    title: parsed.title,
    slug,
    description: parsed.description || null,
    category: parsed.category || null,
    price: parsed.price,
    status: "draft",
  });

  revalidatePath("/instructor/courses");
  redirect("/instructor/courses");
}

export async function updateCourse(
  courseId: string,
  _prev: CourseFormState,
  formData: FormData,
): Promise<CourseFormState> {
  const user = await requireInstructor();
  const parsed = parseCourseForm(formData);
  if ("error" in parsed) return { error: parsed.error };

  // Instruktur hanya boleh mengubah kursus miliknya; admin bebas
  const existing = await db.query.courses.findFirst({ where: eq(courses.id, courseId) });
  if (!existing) return { error: "Kursus tidak ditemukan" };
  if (user.role !== "admin" && existing.instructorId !== user.id) {
    return { error: "Anda bukan pemilik kursus ini" };
  }

  const slug = await uniqueSlug(parsed.title, courseId);
  await db
    .update(courses)
    .set({
      title: parsed.title,
      slug,
      description: parsed.description || null,
      category: parsed.category || null,
      price: parsed.price,
      updatedAt: new Date(),
    })
    .where(eq(courses.id, courseId));

  revalidatePath("/instructor/courses");
  revalidatePath(`/courses/${slug}`);
  redirect("/instructor/courses");
}

export async function setCourseStatus(courseId: string, status: "draft" | "published" | "archived") {
  const user = await requireInstructor();
  const existing = await db.query.courses.findFirst({ where: eq(courses.id, courseId) });
  if (!existing) return;
  if (user.role !== "admin" && existing.instructorId !== user.id) return;

  await db
    .update(courses)
    .set({ status, updatedAt: new Date() })
    .where(eq(courses.id, courseId));

  revalidatePath("/instructor/courses");
  revalidatePath("/courses");
  revalidatePath(`/courses/${existing.slug}`);
}

export async function deleteCourse(courseId: string) {
  const user = await requireInstructor();
  const existing = await db.query.courses.findFirst({ where: eq(courses.id, courseId) });
  if (!existing) return;
  if (user.role !== "admin" && existing.instructorId !== user.id) return;

  await db.delete(courses).where(eq(courses.id, courseId));
  revalidatePath("/instructor/courses");
  revalidatePath("/courses");
}
