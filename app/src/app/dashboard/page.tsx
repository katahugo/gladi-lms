import Link from "next/link";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { alias } from "drizzle-orm/pg-core";

import { auth, signOut } from "@/auth";
import { DashboardHeader } from "@/components/dashboard-header";
import { db } from "@/db";
import { courses, enrollments, lessons, modules, progress, users } from "@/db/schema";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dashboard Siswa",
  description: "Lanjutkan belajar di Gladi.ID — kursus, progres, dan target mingguan.",
};

const COURSE_IMGS = [
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBqXqGKFEnVgi-IiieZbdHWb8LaF4_t4XxglRuzgB2cC0QQruXxZqQXwllrStuhQo-PbU4diRtmGMludFODB9O699OK7CWiVQXXEPhP9Kb9RQFW53RUwwcoFyfYQ_0OLvfXw2YWHDGUWBr1VJu6JrwIlzqJ_63J7tY89ZxOjbkl1L8P2OC0tSHfXbegHhzFY_8YCcNjVCin4cxZUVwGKfDdNfbJwV1OQ1-dXhxtj27nBJAkfQmFUy-cP_py0C1nBSsQwdw4RFA4ne4",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuC8FbIGb_EMprE-FEc3HfJIQ2lM_liSYBVNspKrklF0Xd7C406t4FDFcIQ270aiobPrQAnh45LZAlCyQdIf3rjzVY9gXXCMEjVTjrKByT7ghx39xtg-UbYT7ZdZ6xOo9UBMNDr4TyVxtKD33KJbHPIfDzc5lze5UQPv5a68PY4LU17rh1YmKkepnfpPhvVopugMOLCy2KyvGD-4-aqu0ec_eGlGQv4uiKVtCUxRk379dcb42415BD3CepIJ2T7JdAP5YHgsOKqRGS8",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCTpMXYEotztyoLCSrZSrAjT2H4UWCOJo1z850HmnmztQnAYUW3IRbkITjzg_UMCEklXBR5ifmgHke2zfVRTJAZgJr60FNy6kgIOfAK1iE7wmRwVnXwFCBYqK0Fzj5v71UR2ii1ud3T5aYFGqK340l00xH_kZeTGoSK4eEILllPNzCAdwFLTsB3gkBW041pgJ1I-LrczJrSkSZ_pS4Y_HA9xx3R6p9nFKs0sD2SghK3BdDs3RXI9prH3fVPx5Bfb44sK_aw7k1v3TI",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDv8shnb4t-hnRhMeUav1q8LZF7DJmHqb2f-QWIA0ua-bYw7oPzqgxY2Xp2Q92yIn--A6GsJAXqFig9paXWIN3SwhPOBBi969iszVjfFNIWzFIe8LniWCJkAqabtfNR-uSdc5aeN6o6g4lrRs0VViskmJVuk3zR0Nq8jzqTvf_L9PaMsHmlAuwQnU0BGM91ahM8pxlg5mSIcRkWqN3h4wsaWdOfsaAmYkBAQyr5bxW3meM54JM4sUUjkKrY2e12uABq30SXVm5Q0t8",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDkUr2DTEfIyLhx-NAzPA5oya7tpPrd1jUG44r7CLMNQD9jBDK21Q5ScmKqU7P92oCG2CukqZQHeGrz2kCBi8b9LJ6_Hrvecq1OCwwLqBdegjdWFl4ONSpK7eBosx7yH4u4l7ATi8bo_5BrGvajasav2OlrAql-5R7mMe73GU7HJnqO7QTjs42cO2NmTy4YP5AscNJ3ol_SIiImFxEpOVRhL0FQQMBEQ-KeLERCcaMBmhtrSh96c_lDqt-M3rHSZ3jAoF4I4HJuWnU",
];

type DashCourse = {
  id: string;
  title: string;
  slug: string;
  category: string;
  instructorName: string;
  percent: number;
  remainingLessons: number;
  image: string;
  href: string;
};

const DEMO_COURSES: DashCourse[] = [
  {
    id: "demo-1",
    title: "Advanced React & Clean Architecture",
    slug: "",
    category: "Fullstack Development",
    instructorName: "Ahmad Rifai",
    percent: 65,
    remainingLessons: 8,
    image: COURSE_IMGS[0],
    href: "/courses",
  },
  {
    id: "demo-2",
    title: "Big Data Processing with Python",
    slug: "",
    category: "Data Engineering",
    instructorName: "Sarah Chen",
    percent: 28,
    remainingLessons: 18,
    image: COURSE_IMGS[1],
    href: "/courses",
  },
  {
    id: "demo-3",
    title: "Ethical Hacking: Network Defense 2024",
    slug: "",
    category: "Cyber Security",
    instructorName: "Ahmad Rifai",
    percent: 92,
    remainingLessons: 2,
    image: COURSE_IMGS[2],
    href: "/courses",
  },
  {
    id: "demo-4",
    title: "Design Systems for Enterprise Scalability",
    slug: "",
    category: "UI/UX Design",
    instructorName: "Sarah Chen",
    percent: 45,
    remainingLessons: 12,
    image: COURSE_IMGS[3],
    href: "/courses",
  },
  {
    id: "demo-5",
    title: "Mastering Microservices with Go",
    slug: "",
    category: "Backend",
    instructorName: "David Miller",
    percent: 10,
    remainingLessons: 24,
    image: COURSE_IMGS[4],
    href: "/courses",
  },
];

function progressLabel(c: DashCourse): { left: string; right: string; highlight?: boolean } {
  if (c.percent >= 90)
    return { left: `${c.percent}% Selesai`, right: "Hampir selesai!", highlight: true };
  if (c.percent <= 15)
    return { left: `${c.percent}% Selesai`, right: "Kursus baru", highlight: true };
  return {
    left: `${c.percent}% Selesai`,
    right: `${c.remainingLessons} pelajaran tersisa`,
  };
}

/**
 * Dashboard siswa — kursus terdaftar, progres, target, notifikasi.
 */
export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/dashboard");

  // Admin/instruktur punya panel sendiri — jangan tampilkan dashboard siswa.
  if (session.user.role === "admin") redirect("/admin");
  if (session.user.role === "instructor") redirect("/instructor/dashboard");

  const userId = session.user.id;
  const displayName = session.user.name?.trim() || "Siswa";
  const firstName = displayName.split(/\s+/)[0] ?? displayName;

  let myCourses: DashCourse[] = [];
  let usedDemo = false;

  try {
    const instructors = alias(users, "instructors");

    const enrolled = await db
      .select({
        courseId: courses.id,
        title: courses.title,
        slug: courses.slug,
        category: courses.category,
        instructorName: instructors.name,
        enrolledAt: enrollments.enrolledAt,
      })
      .from(enrollments)
      .innerJoin(courses, eq(enrollments.courseId, courses.id))
      .leftJoin(instructors, eq(courses.instructorId, instructors.id))
      .where(
        and(eq(enrollments.userId, userId), eq(enrollments.status, "active")),
      )
      .orderBy(desc(enrollments.enrolledAt));

    if (enrolled.length === 0) {
      usedDemo = true;
      myCourses = DEMO_COURSES;
    } else {
      const courseIds = enrolled.map((e) => e.courseId);

      const mods = await db
        .select({ id: modules.id, courseId: modules.courseId })
        .from(modules)
        .where(inArray(modules.courseId, courseIds))
        .orderBy(asc(modules.sortOrder));

      const modIds = mods.map((m) => m.id);
      const allLessons =
        modIds.length > 0
          ? await db
              .select({ id: lessons.id, moduleId: lessons.moduleId })
              .from(lessons)
              .where(inArray(lessons.moduleId, modIds))
          : [];

      const userProgress = await db
        .select({
          lessonId: progress.lessonId,
          completedAt: progress.completedAt,
          updatedAt: progress.updatedAt,
        })
        .from(progress)
        .where(eq(progress.userId, userId));

      const completedSet = new Set(
        userProgress.filter((p) => p.completedAt).map((p) => p.lessonId),
      );

      const lessonsByCourse = new Map<string, string[]>();
      for (const m of mods) {
        const ids = allLessons
          .filter((l) => l.moduleId === m.id)
          .map((l) => l.id);
        const prev = lessonsByCourse.get(m.courseId) ?? [];
        lessonsByCourse.set(m.courseId, [...prev, ...ids]);
      }

      myCourses = enrolled.map((e, i) => {
        const lessonIds = lessonsByCourse.get(e.courseId) ?? [];
        const total = lessonIds.length;
        const done = lessonIds.filter((id) => completedSet.has(id)).length;
        const percent = total > 0 ? Math.round((done / total) * 100) : 0;
        return {
          id: e.courseId,
          title: e.title,
          slug: e.slug,
          category: e.category ?? "Kursus",
          instructorName: e.instructorName ?? "Instruktur",
          percent,
          remainingLessons: Math.max(0, total - done),
          image: COURSE_IMGS[i % COURSE_IMGS.length],
          href: `/learn/${e.slug}`,
        };
      });
    }
  } catch {
    console.warn("Dashboard: database tidak tersedia, memakai konten demo.");
    usedDemo = true;
    myCourses = DEMO_COURSES;
  }

  const recent = myCourses.slice(0, 2);
  const grid = myCourses.slice(0, 6);
  const continueHref = recent[0]?.href ?? "/courses";

  const avgProgress =
    myCourses.length > 0
      ? Math.round(
          myCourses.reduce((s, c) => s + c.percent, 0) / myCourses.length,
        )
      : 0;

  const weeklyPct = Math.min(100, Math.max(avgProgress, usedDemo ? 85 : avgProgress));
  const weeklyHours = Math.round((weeklyPct / 100) * 15);

  const year = new Date().getFullYear();

  async function logout() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  return (
    <div className="overflow-x-hidden bg-background font-body text-on-surface">
      <DashboardHeader user={session.user} />

      <div className="mx-auto flex min-h-[calc(100vh-160px)] max-w-container-max">
        {/* Sidebar */}
        <aside className="sticky top-20 hidden h-[calc(100vh-80px)] w-64 flex-col border-r border-outline-variant px-margin-desktop py-stack-lg md:flex">
          <nav className="flex flex-1 flex-col gap-2">
            <Link
              href="/dashboard"
              className="flex items-center gap-3 rounded-lg bg-primary px-4 py-3 text-on-primary shadow-sm transition-all"
            >
              <span
                className="material-symbols-outlined"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                dashboard
              </span>
              <span className="font-headline text-label-md">Kursus Saya</span>
            </Link>
            <Link
              href="/courses"
              className="flex items-center gap-3 rounded-lg px-4 py-3 text-on-surface-variant transition-all hover:bg-surface-container-high"
            >
              <span className="material-symbols-outlined">route</span>
              <span className="font-headline text-label-md">Jalur Belajar</span>
            </Link>
            <Link
              href="/courses"
              className="flex items-center gap-3 rounded-lg px-4 py-3 text-on-surface-variant transition-all hover:bg-surface-container-high"
            >
              <span className="material-symbols-outlined">favorite</span>
              <span className="font-headline text-label-md">Daftar Keinginan</span>
            </Link>
            <Link
              href="/dashboard/certificates"
              className="flex items-center gap-3 rounded-lg px-4 py-3 text-on-surface-variant transition-all hover:bg-surface-container-high"
            >
              <span className="material-symbols-outlined">history</span>
              <span className="font-headline text-label-md">Riwayat Belajar</span>
            </Link>
          </nav>

          <div className="border-t border-outline-variant pt-6">
            <Link
              href="/dashboard"
              className="flex items-center gap-3 rounded-lg px-4 py-3 text-on-surface-variant transition-all hover:bg-surface-container-high"
            >
              <span className="material-symbols-outlined">settings</span>
              <span className="font-headline text-label-md">Pengaturan</span>
            </Link>
            <form action={logout}>
              <button
                type="submit"
                className="mt-2 flex w-full items-center gap-3 rounded-lg px-4 py-3 text-error transition-all hover:bg-error-container"
              >
                <span className="material-symbols-outlined">logout</span>
                <span className="font-headline text-label-md">Keluar</span>
              </button>
            </form>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 overflow-y-auto px-margin-mobile py-stack-lg md:px-margin-desktop">
          <section className="mb-stack-lg">
            <div className="relative flex items-center justify-between overflow-hidden rounded-xl bg-primary-container p-8 text-on-primary-container">
              <div className="relative z-10">
                <h1 className="font-headline text-headline-lg mb-2">
                  Halo, {firstName}! 👋
                </h1>
                <p className="font-body text-body-lg opacity-90">
                  {usedDemo
                    ? "Mari lanjutkan belajarmu. Kamu sudah menyelesaikan 85% dari target mingguan."
                    : myCourses.length === 0
                      ? "Belum ada kursus. Jelajahi katalog dan mulai belajar hari ini."
                      : `Mari lanjutkan belajarmu. Rata-rata progres kursusmu ${avgProgress}%.`}
                </p>
                <div className="mt-6 flex flex-wrap gap-4">
                  <Link
                    href={continueHref}
                    className="rounded-full bg-primary px-6 py-2.5 font-headline text-label-md text-on-primary shadow-md transition-all hover:brightness-110"
                  >
                    Lanjut Belajar
                  </Link>
                  <a
                    href="#target-mingguan"
                    className="rounded-full border border-on-primary-container/30 px-6 py-2.5 font-headline text-label-md text-on-primary-container transition-all hover:bg-white/10"
                  >
                    Lihat Target
                  </a>
                </div>
              </div>
              <div className="animate-float relative z-10 hidden lg:block">
                <div className="flex h-32 w-32 rotate-3 items-center justify-center rounded-2xl border border-white/20 bg-primary/20 shadow-xl backdrop-blur-md">
                  <span
                    className="material-symbols-outlined text-5xl text-primary-container"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    terminal
                  </span>
                </div>
              </div>
              <div className="absolute top-0 right-0 h-64 w-64 translate-x-1/4 -translate-y-1/2 rounded-full bg-white/10 blur-3xl" />
              <div className="absolute bottom-0 left-1/2 h-48 w-48 translate-y-1/2 rounded-full bg-primary/30 blur-2xl" />
            </div>
          </section>

          {recent.length > 0 && (
            <section className="mb-12">
              <h2 className="font-headline text-headline-md mb-6 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">bolt</span>
                Baru Saja Diakses
              </h2>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {recent.map((c) => (
                  <Link
                    key={c.id}
                    href={c.href}
                    className="glass-card group flex cursor-pointer gap-6 rounded-xl border-l-4 border-l-primary p-6 transition-all hover:shadow-lg"
                  >
                    <div className="h-24 w-24 shrink-0 overflow-hidden rounded-lg">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        alt=""
                        src={c.image}
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      />
                    </div>
                    <div className="flex-1">
                      <span className="mb-1 block font-headline text-xs font-bold tracking-wider text-primary uppercase">
                        {c.category}
                      </span>
                      <h3 className="font-headline text-headline-md mb-2 text-[20px]">
                        {c.title}
                      </h3>
                      <div className="mb-4 flex items-center justify-between">
                        <div className="mr-4 flex-1">
                          <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container-high">
                            <div
                              className="h-full rounded-full bg-primary-container"
                              style={{ width: `${c.percent}%` }}
                            />
                          </div>
                        </div>
                        <span className="font-headline text-label-md text-on-surface-variant">
                          {c.percent}%
                        </span>
                      </div>
                      <span className="flex items-center gap-2 text-sm font-bold text-primary transition-all group-hover:gap-3">
                        Lanjut Belajar{" "}
                        <span className="material-symbols-outlined text-[20px]">
                          arrow_forward
                        </span>
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <section className="mb-12">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="font-headline text-headline-md flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">
                  library_books
                </span>
                Kursus Saya
              </h2>
              <Link
                href="/courses"
                className="font-headline text-label-md text-primary hover:underline"
              >
                Lihat semua kursus
              </Link>
            </div>

            {grid.length === 0 ? (
              <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-10 text-center">
                <p className="font-headline text-headline-md text-on-surface">
                  Belum ada kursus
                </p>
                <p className="mt-2 text-on-surface-variant">
                  Jelajahi katalog dan daftar ke kursus pertama Anda.
                </p>
                <Link
                  href="/courses"
                  className="mt-6 inline-block rounded-full bg-primary px-6 py-2.5 font-headline text-label-md text-on-primary"
                >
                  Jelajahi Katalog
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {grid.map((c) => {
                  const label = progressLabel(c);
                  return (
                    <Link
                      key={c.id}
                      href={c.href}
                      className="group overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest transition-all hover:shadow-md"
                    >
                      <div className="aspect-video w-full overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          alt=""
                          src={c.image}
                          className="h-full w-full object-cover transition-transform group-hover:scale-105"
                        />
                      </div>
                      <div className="p-5">
                        <div className="mb-2 flex items-start justify-between">
                          <span className="rounded bg-primary-container/20 px-2 py-0.5 text-[11px] font-bold text-on-primary-container uppercase">
                            {c.category}
                          </span>
                          <span className="material-symbols-outlined text-[20px] text-on-surface-variant transition-colors group-hover:text-error">
                            favorite
                          </span>
                        </div>
                        <h4 className="font-headline mb-2 text-[18px] leading-tight">
                          {c.title}
                        </h4>
                        <p className="font-headline text-label-md mb-4 text-xs text-on-surface-variant">
                          Instruktur: {c.instructorName}
                        </p>
                        <div className="space-y-1">
                          <div className="h-1.5 w-full rounded-full bg-surface-container-high">
                            <div
                              className="h-full rounded-full bg-primary-container"
                              style={{ width: `${c.percent}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-[11px] font-medium">
                            <span>{label.left}</span>
                            <span
                              className={
                                label.highlight
                                  ? "font-bold text-primary"
                                  : "text-on-surface-variant"
                              }
                            >
                              {label.right}
                            </span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        </main>

        {/* Right panel */}
        <aside className="hidden w-80 flex-col border-l border-outline-variant bg-surface-container-low px-6 py-stack-lg xl:flex">
          <div id="target-mingguan" className="mb-8">
            <h3 className="font-headline mb-4 flex items-center gap-2 text-[20px]">
              <span className="material-symbols-outlined text-primary">target</span>
              Target Mingguan
            </h3>
            <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <span className="font-headline text-label-md font-bold">
                  {weeklyHours} / 15 Jam
                </span>
                <span className="font-headline text-label-md font-bold text-primary">
                  {weeklyPct}%
                </span>
              </div>
              <div className="mb-6 h-2.5 w-full rounded-full bg-surface-container-high">
                <div
                  className="h-full rounded-full bg-primary-container"
                  style={{ width: `${weeklyPct}%` }}
                />
              </div>
              <ul className="space-y-3">
                <li className="flex items-center gap-3 font-headline text-label-md">
                  <span
                    className="material-symbols-outlined text-[20px] text-primary"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    check_circle
                  </span>
                  <span className="line-through opacity-50">Selesaikan Modul React</span>
                </li>
                <li className="flex items-center gap-3 font-headline text-label-md">
                  <span
                    className="material-symbols-outlined text-[20px] text-primary"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    check_circle
                  </span>
                  <span className="line-through opacity-50">Tonton 3 Kuliah Desain</span>
                </li>
                <li className="flex items-center gap-3 font-headline text-label-md">
                  <span className="material-symbols-outlined text-[20px] text-outline">
                    radio_button_unchecked
                  </span>
                  <span>Ikuti Kuis Cyber Security</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="flex flex-1 flex-col overflow-hidden">
            <h3 className="font-headline mb-4 flex items-center gap-2 text-[20px]">
              <span className="material-symbols-outlined text-primary">
                notifications_active
              </span>
              Notifikasi
            </h3>
            <div className="custom-scrollbar flex-1 space-y-4 overflow-y-auto pr-2">
              <div className="rounded-xl border-l-4 border-l-primary-container bg-surface-container-lowest p-4 shadow-sm">
                <p className="font-headline text-label-md mb-1 font-bold">
                  Pelajaran Baru Tersedia!
                </p>
                <p className="text-[12px] text-on-surface-variant">
                  Modul baru dari kursusmu sudah tayang. Lanjutkan sekarang.
                </p>
                <span className="mt-2 block text-[10px] text-outline">2 jam yang lalu</span>
              </div>
              <div className="rounded-xl border-l-4 border-l-primary bg-surface-container-lowest p-4 shadow-sm">
                <p className="font-headline text-label-md mb-1 font-bold">
                  Pencapaian Baru 🏆
                </p>
                <p className="text-[12px] text-on-surface-variant">
                  Kamu telah menyelesaikan beruntun belajar selama 7 hari.
                </p>
                <span className="mt-2 block text-[10px] text-outline">Kemarin</span>
              </div>
              <div className="rounded-xl border-l-4 border-l-error bg-surface-container-lowest p-4 shadow-sm">
                <p className="font-headline text-label-md mb-1 font-bold">
                  Pengingat Tenggat
                </p>
                <p className="text-[12px] text-on-surface-variant">
                  Selesaikan kuis atau proyek yang hampir jatuh tempo.
                </p>
                <span className="mt-2 block text-[10px] text-outline">1 hari yang lalu</span>
              </div>
            </div>
          </div>
        </aside>
      </div>

      <footer className="bg-primary">
        <div className="mx-auto flex w-full max-w-container-max flex-col items-start justify-between px-margin-mobile py-stack-lg md:flex-row md:px-margin-desktop">
          <div className="mb-stack-md md:mb-0">
            <span className="font-headline mb-2 block font-bold text-on-primary">
              Gladi.ID
            </span>
            <p className="max-w-xs font-body text-xs text-on-primary/80">
              Memberdayakan Presisi Teknis melalui pembelajaran sistematis dan kurikulum
              profesional.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 md:gap-16">
            <div>
              <h5 className="font-headline text-label-md mb-4 font-bold text-on-primary">
                Kursus
              </h5>
              <ul className="space-y-2">
                <li>
                  <Link
                    href="/courses"
                    className="text-xs text-on-primary/80 transition-colors hover:text-primary-fixed"
                  >
                    Web Dev
                  </Link>
                </li>
                <li>
                  <Link
                    href="/courses"
                    className="text-xs text-on-primary/80 transition-colors hover:text-primary-fixed"
                  >
                    Data Science
                  </Link>
                </li>
                <li>
                  <Link
                    href="/courses"
                    className="text-xs text-on-primary/80 transition-colors hover:text-primary-fixed"
                  >
                    Cyber Security
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h5 className="font-headline text-label-md mb-4 font-bold text-on-primary">
                Perusahaan
              </h5>
              <ul className="space-y-2">
                <li>
                  <Link
                    href="/"
                    className="text-xs text-on-primary/80 transition-colors hover:text-primary-fixed"
                  >
                    Tentang Kami
                  </Link>
                </li>
                <li>
                  <Link
                    href="/dashboard/certificates"
                    className="text-xs text-on-primary/80 transition-colors hover:text-primary-fixed"
                  >
                    Sertifikat
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h5 className="font-headline text-label-md mb-4 font-bold text-on-primary">
                Sosial
              </h5>
              <ul className="space-y-2">
                <li>
                  <span className="cursor-default text-xs text-on-primary/80">LinkedIn</span>
                </li>
                <li>
                  <span className="cursor-default text-xs text-on-primary/80">Twitter</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
        <div className="mx-auto flex w-full max-w-container-max items-center justify-between border-t border-on-primary/10 px-margin-mobile py-6 text-xs text-on-primary/60 md:px-margin-desktop">
          <span>© {year} Gladi.ID. Memberdayakan Presisi Teknis.</span>
          <div className="flex gap-4">
            <span className="cursor-default hover:text-on-primary">Kebijakan Privasi</span>
            <span className="cursor-default hover:text-on-primary">Ketentuan Layanan</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
