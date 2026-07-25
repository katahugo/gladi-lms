import Link from "next/link";
import { and, avg, count, desc, eq, ilike, sql } from "drizzle-orm";
import type { Metadata } from "next";

import { AdminCourseRowActions } from "@/components/admin-course-row-actions";
import { AdminCoursesFilters } from "@/components/admin-courses-filters";
import { db } from "@/db";
import { courseReviews, courses, enrollments, users } from "@/db/schema";
import { requireRole } from "@/lib/guards";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Manajemen Kursus",
  description: "Kelola konten edukasi dan pantau perkembangan materi belajar.",
};

const PAGE_SIZE = 10;

const THUMBS = [
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBhNsWKAslTNDO_qo9S3RAs_eqYni5qSPFwQx-HO9RPwlEAVvNsXcb9McjRhPsvNyeQmSdICVM5B4Fbt-4wlJCNlrs1WdvH_ogxZsWVijtncp5JFArXGHfkG1HsD5-l9JCPscOwFTkIfFIbTPlju2EhR2k5Q3iKXN5I-CBst69eX8cgofUJR2E8yKH9e6d5sI26eoY57h-Vj3aflwRmYmuwiijYijN7zbFWdMFOlAfjGqcjOp911KNTxVo0r6P-4SqpDaigSy5iBnU",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCZOEdvzpl1eleiV_04AccPzfHDyZQHETXa5ne7kCz9z-wS8CYmBbDm5GOfVmP52A9MHr4Nue5yr5V53urtqgYXlGdcTqd7vIuB_9qscE3elB4qCD8Gn8s68sU6PVZ24X0kAZIue8KQDymKYfoDhboYlpVWge_gENVk0hWrQTM4_3Bi5KyspU_Vy8gn4sOG7U9K-z1wmXOyI7I9jRsfDr3Cu2l23mpI8Eq85nrTU5w0le_jiJpv3-Uv2EX3HkCQo3y3l05yP1PhOvY",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBtJAsacVnb8550LfavYv7ScEhCPLUmlw2wsbp1u6L8VUOSj34voB6JvkNXJjprWFy3UdEaaMppnHUjTdtNn1Ev5cmzNXpX5gi4gOp2sjrxxixLqw4hbVPJFygFMyuA7Uaf5X_MtrR4UwMrh7p0nhrhAiBCx3rH0lzcr4JF7Lh7Wa3F7-vfwoGmdxbXc3o3JFmW-72YMI_dqR0L00sHNA037kFnI53c06UEj-eKuDdZQ0_T7Y1I-KKoMAsOrwoZoyfbVSqKSXojv6s",
];

type CourseRow = {
  id: string;
  title: string;
  slug: string;
  category: string | null;
  status: "draft" | "published" | "archived";
  instructorName: string;
  students: number;
  rating: number | null;
  image: string;
};

const DEMO_ROWS: CourseRow[] = [
  {
    id: "demo-1",
    title: "Mastering React & Next.js",
    slug: "mastering-react-nextjs",
    category: "Web Dev",
    status: "published",
    instructorName: "Ahmad Kurnia",
    students: 1240,
    rating: 4.9,
    image: THUMBS[0],
  },
  {
    id: "demo-2",
    title: "Data Science with Python",
    slug: "data-science-python",
    category: "Data Science",
    status: "archived",
    instructorName: "Siti Rahma",
    students: 856,
    rating: 4.7,
    image: THUMBS[1],
  },
  {
    id: "demo-3",
    title: "Advanced Cyber Security",
    slug: "advanced-cyber-security",
    category: "Cyber Security",
    status: "draft",
    instructorName: "Budi Santoso",
    students: 0,
    rating: null,
    image: THUMBS[2],
  },
];

function statusUi(status: CourseRow["status"]) {
  if (status === "published") {
    return {
      label: "Aktif",
      className: "text-primary",
      dot: "bg-primary animate-pulse",
    };
  }
  if (status === "archived") {
    return {
      label: "Review",
      className: "text-amber-600",
      dot: "bg-amber-500",
    };
  }
  return {
    label: "Draft",
    className: "text-outline",
    dot: "bg-outline",
  };
}

function buildPageHref(
  page: number,
  params: { q: string; category: string; status: string },
): string {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.category) sp.set("category", params.category);
  if (params.status) sp.set("status", params.status);
  if (page > 1) sp.set("page", String(page));
  const qs = sp.toString();
  return qs ? `/admin/courses?${qs}` : "/admin/courses";
}

/**
 * Manajemen kursus admin — daftar, filter, statistik, pagination.
 */
export default async function AdminCoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; status?: string; page?: string }>;
}) {
  await requireRole(["admin"]);
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const category = (sp.category ?? "").trim();
  const statusFilter = (sp.status ?? "").trim();
  const page = Math.max(1, Number(sp.page ?? "1") || 1);

  let rows: CourseRow[] = [];
  let totalFiltered = 0;
  let stats = { total: 124, active: 86, review: 18, draft: 20 };
  let categories: string[] = ["Web Dev", "Data Science", "Cyber Security"];
  let usingDemo = false;

  try {
    const [totalRow] = await db.select({ total: count(courses.id) }).from(courses);
    const [pubRow] = await db
      .select({ total: count(courses.id) })
      .from(courses)
      .where(eq(courses.status, "published"));
    const [archRow] = await db
      .select({ total: count(courses.id) })
      .from(courses)
      .where(eq(courses.status, "archived"));
    const [draftRow] = await db
      .select({ total: count(courses.id) })
      .from(courses)
      .where(eq(courses.status, "draft"));

    const total = Number(totalRow?.total ?? 0);
    if (total === 0) {
      usingDemo = true;
    } else {
      stats = {
        total,
        active: Number(pubRow?.total ?? 0),
        review: Number(archRow?.total ?? 0),
        draft: Number(draftRow?.total ?? 0),
      };

      const catRows = await db
        .selectDistinct({ category: courses.category })
        .from(courses)
        .where(sql`${courses.category} is not null and ${courses.category} <> ''`);
      categories = catRows
        .map((r) => r.category)
        .filter((c): c is string => Boolean(c))
        .sort((a, b) => a.localeCompare(b, "id"));

      const filters = [];
      if (q) filters.push(ilike(courses.title, `%${q}%`));
      if (category) filters.push(eq(courses.category, category));
      if (statusFilter === "published" || statusFilter === "draft" || statusFilter === "archived") {
        filters.push(eq(courses.status, statusFilter));
      }
      const where = filters.length > 0 ? and(...filters) : undefined;

      const [filteredCount] = await db
        .select({ total: count(courses.id) })
        .from(courses)
        .where(where);
      totalFiltered = Number(filteredCount?.total ?? 0);

      const studentCount = sql<number>`coalesce(count(distinct ${enrollments.userId}), 0)`.mapWith(
        Number,
      );
      const avgRating = avg(courseReviews.rating);

      const data = await db
        .select({
          id: courses.id,
          title: courses.title,
          slug: courses.slug,
          category: courses.category,
          status: courses.status,
          instructorName: users.name,
          students: studentCount,
          rating: avgRating,
        })
        .from(courses)
        .leftJoin(users, eq(courses.instructorId, users.id))
        .leftJoin(enrollments, eq(enrollments.courseId, courses.id))
        .leftJoin(courseReviews, eq(courseReviews.courseId, courses.id))
        .where(where)
        .groupBy(
          courses.id,
          courses.title,
          courses.slug,
          courses.category,
          courses.status,
          users.name,
          courses.createdAt,
        )
        .orderBy(desc(courses.createdAt))
        .limit(PAGE_SIZE)
        .offset((page - 1) * PAGE_SIZE);

      rows = data.map((r, i) => ({
        id: r.id,
        title: r.title,
        slug: r.slug,
        category: r.category,
        status: r.status,
        instructorName: r.instructorName?.trim() || "—",
        students: r.students,
        rating: r.rating != null ? Number(Number(r.rating).toFixed(1)) : null,
        image: THUMBS[i % THUMBS.length],
      }));
    }
  } catch {
    usingDemo = true;
  }

  if (usingDemo) {
    rows = DEMO_ROWS.filter((r) => {
      if (q && !r.title.toLowerCase().includes(q.toLowerCase())) return false;
      if (category && r.category !== category) return false;
      if (statusFilter && r.status !== statusFilter) return false;
      return true;
    });
    totalFiltered = rows.length;
  }

  const totalPages = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const from = totalFiltered === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const to = Math.min(safePage * PAGE_SIZE, totalFiltered);
  const filterParams = { q, category, status: statusFilter };

  const pageButtons: number[] = [];
  for (let p = 1; p <= Math.min(totalPages, 3); p += 1) pageButtons.push(p);
  if (safePage > 3 && !pageButtons.includes(safePage)) {
    pageButtons[pageButtons.length - 1] = safePage;
  }

  return (
    <div className="mx-auto max-w-7xl p-unit-6 lg:p-unit-8">
      <div className="mb-unit-8 flex flex-col justify-between gap-unit-4 md:flex-row md:items-center">
        <div>
          <h1 className="font-headline text-headline-lg text-on-surface">Manajemen Kursus</h1>
          <p className="font-body text-body-md text-on-surface-variant">
            Kelola konten edukasi dan pantau perkembangan materi belajar.
          </p>
        </div>
        <Link
          href="/instructor/courses/new"
          className="flex items-center gap-unit-2 rounded-xl bg-primary-container px-unit-6 py-unit-3 font-headline font-bold text-on-primary-container shadow-sm transition-all hover:scale-[1.02] active:scale-95"
        >
          <span className="material-symbols-outlined">add</span>
          Tambah Kursus Baru
        </Link>
      </div>

      <div className="mb-unit-8 grid grid-cols-1 gap-unit-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="glass-card flex items-center gap-unit-4 rounded-2xl p-unit-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-fixed text-on-primary-fixed">
            <span className="material-symbols-outlined">auto_stories</span>
          </div>
          <div>
            <p className="font-headline text-label-md text-on-surface-variant">Total Kursus</p>
            <p className="font-headline text-headline-md">{stats.total}</p>
          </div>
        </div>
        <div className="glass-card flex items-center gap-unit-4 rounded-2xl p-unit-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-container text-on-primary-container">
            <span className="material-symbols-outlined">check_circle</span>
          </div>
          <div>
            <p className="font-headline text-label-md text-on-surface-variant">Kursus Aktif</p>
            <p className="font-headline text-headline-md">{stats.active}</p>
          </div>
        </div>
        <div className="glass-card flex items-center gap-unit-4 rounded-2xl p-unit-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary-container text-on-secondary-container">
            <span className="material-symbols-outlined">pending</span>
          </div>
          <div>
            <p className="font-headline text-label-md text-on-surface-variant">Menunggu Review</p>
            <p className="font-headline text-headline-md">{stats.review}</p>
          </div>
        </div>
        <div className="glass-card flex items-center gap-unit-4 rounded-2xl p-unit-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-container-highest text-on-surface-variant">
            <span className="material-symbols-outlined">edit_note</span>
          </div>
          <div>
            <p className="font-headline text-label-md text-on-surface-variant">Kursus Draft</p>
            <p className="font-headline text-headline-md">{stats.draft}</p>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-sm">
        <AdminCoursesFilters
          q={q}
          category={category}
          status={statusFilter}
          categories={categories}
        />

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-surface-container-low">
                <th className="px-unit-6 py-unit-4 font-headline text-sm font-bold text-on-surface-variant">
                  Judul Kursus
                </th>
                <th className="px-unit-6 py-unit-4 font-headline text-sm font-bold text-on-surface-variant">
                  Kategori
                </th>
                <th className="px-unit-6 py-unit-4 font-headline text-sm font-bold text-on-surface-variant">
                  Instruktur
                </th>
                <th className="px-unit-6 py-unit-4 text-center font-headline text-sm font-bold text-on-surface-variant">
                  Siswa
                </th>
                <th className="px-unit-6 py-unit-4 text-center font-headline text-sm font-bold text-on-surface-variant">
                  Rating
                </th>
                <th className="px-unit-6 py-unit-4 font-headline text-sm font-bold text-on-surface-variant">
                  Status
                </th>
                <th className="px-unit-6 py-unit-4 text-right font-headline text-sm font-bold text-on-surface-variant">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-unit-6 py-12 text-center text-sm text-on-surface-variant"
                  >
                    Tidak ada kursus yang cocok dengan filter.
                  </td>
                </tr>
              ) : (
                rows.map((c) => {
                  const st = statusUi(c.status);
                  return (
                    <tr
                      key={c.id}
                      className="group transition-colors hover:bg-surface-container/40"
                    >
                      <td className="px-unit-6 py-unit-4">
                        <div className="flex items-center gap-unit-3">
                          <div className="h-8 w-12 overflow-hidden rounded bg-secondary-container">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={c.image}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          </div>
                          <span className="font-headline text-label-md font-semibold text-on-surface transition-colors group-hover:text-primary">
                            {c.title}
                          </span>
                        </div>
                      </td>
                      <td className="px-unit-6 py-unit-4">
                        {c.category ? (
                          <span className="rounded-full bg-surface-container-highest px-3 py-1 text-[12px] font-medium text-on-surface-variant">
                            {c.category}
                          </span>
                        ) : (
                          <span className="text-sm text-outline">—</span>
                        )}
                      </td>
                      <td className="px-unit-6 py-unit-4 text-sm text-on-surface-variant">
                        {c.instructorName}
                      </td>
                      <td className="px-unit-6 py-unit-4 text-center text-sm font-medium">
                        {c.students.toLocaleString("en-US")}
                      </td>
                      <td className="px-unit-6 py-unit-4 text-center">
                        {c.rating != null ? (
                          <div className="flex items-center justify-center gap-1">
                            <span
                              className="material-symbols-outlined text-[16px] text-amber-500"
                              style={{ fontVariationSettings: '"FILL" 1' }}
                            >
                              star
                            </span>
                            <span className="text-sm font-bold">{c.rating.toFixed(1)}</span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-1">
                            <span className="material-symbols-outlined text-[16px] text-outline">
                              star
                            </span>
                            <span className="text-sm font-bold text-outline">-</span>
                          </div>
                        )}
                      </td>
                      <td className="px-unit-6 py-unit-4">
                        <span
                          className={`flex items-center gap-1.5 text-[12px] font-bold ${st.className}`}
                        >
                          <span className={`h-2 w-2 rounded-full ${st.dot}`} />
                          {st.label}
                        </span>
                      </td>
                      <td className="px-unit-6 py-unit-4 text-right">
                        {usingDemo ? (
                          <div className="flex items-center justify-end gap-2 opacity-40">
                            <span className="material-symbols-outlined text-[20px]">visibility</span>
                            <span className="material-symbols-outlined text-[20px]">edit</span>
                            <span className="material-symbols-outlined text-[20px]">delete</span>
                          </div>
                        ) : (
                          <AdminCourseRowActions
                            id={c.id}
                            slug={c.slug}
                            status={c.status}
                          />
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-outline-variant bg-surface-container-low p-unit-6">
          <span className="text-sm text-on-surface-variant">
            Menampilkan {from}-{to} dari {totalFiltered} Kursus
          </span>
          <div className="flex items-center gap-unit-2">
            {safePage <= 1 ? (
              <span className="flex h-8 w-8 items-center justify-center rounded border border-outline-variant bg-surface opacity-50">
                <span className="material-symbols-outlined text-[18px]">chevron_left</span>
              </span>
            ) : (
              <Link
                href={buildPageHref(safePage - 1, filterParams)}
                className="flex h-8 w-8 items-center justify-center rounded border border-outline-variant bg-surface hover:bg-surface-container"
              >
                <span className="material-symbols-outlined text-[18px]">chevron_left</span>
              </Link>
            )}
            {pageButtons.map((p) =>
              p === safePage ? (
                <span
                  key={p}
                  className="flex h-8 w-8 items-center justify-center rounded border border-primary bg-primary text-sm font-bold text-white"
                >
                  {p}
                </span>
              ) : (
                <Link
                  key={p}
                  href={buildPageHref(p, filterParams)}
                  className="flex h-8 w-8 items-center justify-center rounded border border-outline-variant bg-surface text-sm hover:bg-surface-container"
                >
                  {p}
                </Link>
              ),
            )}
            {safePage >= totalPages ? (
              <span className="flex h-8 w-8 items-center justify-center rounded border border-outline-variant bg-surface opacity-50">
                <span className="material-symbols-outlined text-[18px]">chevron_right</span>
              </span>
            ) : (
              <Link
                href={buildPageHref(safePage + 1, filterParams)}
                className="flex h-8 w-8 items-center justify-center rounded border border-outline-variant bg-surface hover:bg-surface-container"
              >
                <span className="material-symbols-outlined text-[18px]">chevron_right</span>
              </Link>
            )}
          </div>
        </div>
      </div>

      {usingDemo && (
        <p className="mt-4 text-center text-[11px] text-on-surface-variant">
          Menampilkan data contoh — hubungkan database untuk daftar kursus langsung.
        </p>
      )}
    </div>
  );
}
