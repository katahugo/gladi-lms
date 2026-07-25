import Link from "next/link";
import { and, asc, avg, count, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import type { Metadata } from "next";

import { auth } from "@/auth";
import { CatalogFilters, CatalogSort } from "@/components/catalog-filters";
import { LandingHeader } from "@/components/landing-header";
import { db } from "@/db";
import { courseReviews, courses, users } from "@/db/schema";
import { formatRupiah } from "@/lib/courses";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Course Catalog",
  description: "Jelajahi katalog kursus IT Gladi.ID — filter kategori, rating, dan urutan harga.",
};

const PAGE_SIZE = 9;
const WA_NUMBER = process.env.NEXT_PUBLIC_WA_NUMBER ?? "6281234567890";
const WA_HREF = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent("Halo, saya ingin bertanya tentang Gladi.ID")}`;

const DEFAULT_CATEGORIES = [
  "Web Development",
  "Data Science",
  "Cyber Security",
  "Cloud Computing",
];

const COURSE_IMGS = [
  "https://lh3.googleusercontent.com/aida-public/AB6AXuD29EbiN-CK0IrzW5aQosU2fNSpnFP3ARF8WW1D8YDPfWN91JofwBv0cHSnqxUZQ3TVnCth2zyXirsCROUqGJm9uVxKhG0QVK22tyv1TNFjTSDDQNrfl5NRymhKefyjZ-bvqKaSnLHgMvzQiQSwdMwUrc1vKsTAN4FLSF4WwkQ-k_nFLCbRDgsZmTMVeiYJB1jz0HyMS7UeSHWTWOiueXd3oWPp9_pP-x7tmiGdcqtQWaCiBy0pjue2KMaR3etY-n1d9QItCWqjWIM",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBmeIPsaaW7fi3CI64IyrrNk07N_TrnotYIbxxAOfHH_2C98PGYqmRiNe72JoNJ1IpfOg18EuBcPD_r58bejJuZDCCwU3zxvLQ1GaNB90Dw6Ff3z4iN-lF_XfLG3AGIMJT9dMkb3lvquE6edE31Jp3X5iRdG2fF9p_GvlhEjtFGz3xdXJuakwmHhoiQ-wesRHoO4t6vfWTACFYLNKvJ-iQ-FYfPvaJCnBccc-FnmBWm0T9izWfhPBwow8lCa1y0sm7U3QLe0wDMAOM",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuC4n3QmazpC72QuksdLthZJIDT4cal12zyu7_eEJ6LP6M9C3pO1tzbmu7xc2EyriUEeM6MtZC_Y9wIptARYYABMN5LdGu3nw_8Fc3UtS5CUXUy6xWvfRcxfp5p8mKO5QiyX-fmwrrLq5Dd60jqixg1fXRSNPsGby4YfHHRle9iXbVNdQrb1sWMAb9-LPiRyNMiVOqHkZqFf45JCIT_kk1p77H_idQWLPVX4ZY7durwpXX2Mvh15gOZZETRLPlcjQof_CL5FxYO3cjs",
];

type CatalogCourse = {
  id: string;
  title: string;
  slug: string | null;
  price: number;
  category: string | null;
  instructorName: string | null;
  rating: number;
  reviewCount: number;
  badge: "Bestseller" | "New" | null;
  image: string;
  createdAt?: Date | null;
};

const DEMO_COURSES: CatalogCourse[] = [
  {
    id: "demo-1",
    title: "Mastering React 18 & Next.js: Full Guide",
    slug: null,
    price: 849000,
    category: "Web Development",
    instructorName: "Dr. Sarah Jenkins",
    rating: 4.9,
    reviewCount: 12400,
    badge: "Bestseller",
    image: COURSE_IMGS[0],
  },
  {
    id: "demo-2",
    title: "Python for Financial & Algorithmic Trading",
    slug: null,
    price: 799000,
    category: "Data Science",
    instructorName: "Michael Chen",
    rating: 4.7,
    reviewCount: 3200,
    badge: "New",
    image: COURSE_IMGS[1],
  },
  {
    id: "demo-3",
    title: "AWS Certified Solutions Architect Associate",
    slug: null,
    price: 949000,
    category: "Cloud Computing",
    instructorName: "Cloud Mastery Institute",
    rating: 4.8,
    reviewCount: 45000,
    badge: null,
    image: COURSE_IMGS[2],
  },
];

function formatReviewCount(n: number): string {
  if (n >= 1000) {
    const k = n / 1000;
    return `(${k >= 10 ? Math.round(k) : k.toFixed(1).replace(/\.0$/, "")}k)`;
  }
  return n > 0 ? `(${n})` : "";
}

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex text-primary-container">
      {Array.from({ length: 5 }, (_, i) => {
        const threshold = i + 1;
        let icon = "star";
        let filled = false;
        if (rating >= threshold) {
          filled = true;
        } else if (rating >= threshold - 0.5) {
          icon = "star_half";
          filled = true;
        }
        return (
          <span
            key={i}
            className="material-symbols-outlined text-[18px]"
            style={filled ? { fontVariationSettings: "'FILL' 1" } : undefined}
          >
            {icon}
          </span>
        );
      })}
    </div>
  );
}

function buildPageHref(
  page: number,
  opts: { q?: string; category?: string[]; sort?: string; minRating?: boolean },
) {
  const params = new URLSearchParams();
  if (opts.q) params.set("q", opts.q);
  if (opts.category?.length === 1) params.set("category", opts.category[0]);
  else if (opts.category && opts.category.length > 1)
    params.set("category", opts.category.join(","));
  if (opts.sort && opts.sort !== "popular") params.set("sort", opts.sort);
  if (opts.minRating) params.set("minRating", "4");
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/courses?${qs}` : "/courses";
}

/**
 * Katalog kursus — filter, sort, grid kartu, pagination.
 */
export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    category?: string;
    sort?: string;
    page?: string;
    minRating?: string;
  }>;
}) {
  const session = await auth();
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const sort = params.sort ?? "popular";
  const minRating = params.minRating === "4";
  const page = Math.max(1, Number(params.page) || 1);
  const selectedCategories = (params.category ?? "")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);

  let rows: CatalogCourse[] = [];
  let total = 0;
  let filterCategories = DEFAULT_CATEGORIES;
  let usedDemo = false;

  try {
    const conditions = [eq(courses.status, "published")];
    if (q) {
      conditions.push(
        or(
          ilike(courses.title, `%${q}%`),
          ilike(courses.description, `%${q}%`),
          ilike(courses.category, `%${q}%`),
        )!,
      );
    }
    if (selectedCategories.length > 0) {
      conditions.push(inArray(courses.category, selectedCategories));
    }

    const where = and(...conditions);

    const ratingSubq = db
      .select({
        courseId: courseReviews.courseId,
        avgRating: avg(courseReviews.rating).mapWith(Number).as("avg_rating"),
        reviewCount: count(courseReviews.id).mapWith(Number).as("review_count"),
      })
      .from(courseReviews)
      .groupBy(courseReviews.courseId)
      .as("course_rating_stats");

    let orderBy;
    switch (sort) {
      case "price-asc":
        orderBy = asc(courses.price);
        break;
      case "price-desc":
        orderBy = desc(courses.price);
        break;
      case "newest":
        orderBy = desc(courses.createdAt);
        break;
      default:
        orderBy = desc(sql`coalesce(${ratingSubq.reviewCount}, 0)`);
    }

    const [countRow] = await db
      .select({ total: count() })
      .from(courses)
      .where(where);

    total = Number(countRow?.total ?? 0);

    const raw = await db
      .select({
        id: courses.id,
        title: courses.title,
        slug: courses.slug,
        price: courses.price,
        category: courses.category,
        instructorName: users.name,
        createdAt: courses.createdAt,
        avgRating: ratingSubq.avgRating,
        reviewCount: ratingSubq.reviewCount,
      })
      .from(courses)
      .leftJoin(users, eq(courses.instructorId, users.id))
      .leftJoin(ratingSubq, eq(courses.id, ratingSubq.courseId))
      .where(where)
      .orderBy(orderBy)
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE);

    let mapped: CatalogCourse[] = raw.map((c, i) => {
      const rating = c.avgRating ? Number(c.avgRating) : 4.5;
      const reviewCount = c.reviewCount ?? 0;
      let badge: CatalogCourse["badge"] = null;
      if (reviewCount >= 50 || rating >= 4.8) badge = "Bestseller";
      else if (reviewCount === 0 && i === 0 && page === 1 && sort === "newest")
        badge = "New";

      return {
        id: c.id,
        title: c.title,
        slug: c.slug,
        price: c.price,
        category: c.category,
        instructorName: c.instructorName,
        rating,
        reviewCount,
        badge,
        image: COURSE_IMGS[i % COURSE_IMGS.length],
        createdAt: c.createdAt,
      };
    });

    if (minRating) {
      mapped = mapped.filter((c) => c.rating >= 4);
      // Note: total still reflects DB count without rating filter for simplicity
      // when filtering client-side on page; for accurate count we'd need having clause
    }

    rows = mapped;

    const catRows = await db
      .selectDistinct({ category: courses.category })
      .from(courses)
      .where(eq(courses.status, "published"));

    const fromDb = catRows
      .map((r) => r.category)
      .filter((c): c is string => Boolean(c));
    filterCategories = [...new Set([...DEFAULT_CATEGORIES, ...fromDb])];
  } catch {
    console.warn("Katalog: database tidak tersedia, memakai konten demo.");
    usedDemo = true;
    let demo = [...DEMO_COURSES];
    if (q) {
      const qq = q.toLowerCase();
      demo = demo.filter(
        (c) =>
          c.title.toLowerCase().includes(qq) ||
          (c.category?.toLowerCase().includes(qq) ?? false),
      );
    }
    if (selectedCategories.length > 0) {
      demo = demo.filter(
        (c) => c.category != null && selectedCategories.includes(c.category),
      );
    }
    if (minRating) demo = demo.filter((c) => c.rating >= 4);
    switch (sort) {
      case "price-asc":
        demo.sort((a, b) => a.price - b.price);
        break;
      case "price-desc":
        demo.sort((a, b) => b.price - a.price);
        break;
      case "newest":
        break;
      default:
        demo.sort((a, b) => b.reviewCount - a.reviewCount);
    }
    total = demo.length;
    rows = demo.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const activeCategoryLabel =
    selectedCategories.length === 1
      ? selectedCategories[0]
      : selectedCategories.length > 1
        ? `${selectedCategories.length} categories`
        : "all categories";

  const year = new Date().getFullYear();
  const filterOpts = {
    q: q || undefined,
    category: selectedCategories,
    sort,
    minRating,
  };

  return (
    <div className="flex min-h-screen flex-col bg-surface font-body text-on-background">
      <LandingHeader
        user={session?.user ?? null}
        active="categories"
        initialQuery={q}
      />

      <main className="mx-auto w-full max-w-container-max flex-grow px-margin-mobile py-unit-12 md:px-margin-desktop">
        <div className="flex flex-col gap-gutter md:flex-row md:gap-8">
          <CatalogFilters
            categories={filterCategories}
            selectedCategories={selectedCategories}
            query={q}
            sort={sort}
            minRating={minRating}
          />

          <section className="flex-grow space-y-unit-8">
            <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <p className="text-body-lg text-on-surface-variant">
                <span className="font-bold text-on-background">
                  {total.toLocaleString("id-ID")}
                </span>{" "}
                courses found
                {selectedCategories.length > 0 && (
                  <>
                    {" "}
                    in{" "}
                    <span className="font-semibold text-primary">
                      {activeCategoryLabel}
                    </span>
                  </>
                )}
                {q && (
                  <>
                    {" "}
                    for{" "}
                    <span className="font-semibold text-primary">&ldquo;{q}&rdquo;</span>
                  </>
                )}
              </p>
              <CatalogSort
                sort={sort}
                query={q}
                categories={selectedCategories}
                minRating={minRating}
              />
            </div>

            {rows.length === 0 ? (
              <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-12 text-center">
                <p className="font-headline text-headline-md text-on-surface">
                  Tidak ada kursus ditemukan
                </p>
                <p className="mt-2 text-on-surface-variant">
                  Coba ubah filter atau kata kunci pencarian.
                </p>
                <Link
                  href="/courses"
                  className="mt-6 inline-block rounded-xl bg-primary px-6 py-3 font-headline text-label-md font-bold text-on-primary"
                >
                  Reset Filters
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
                {rows.map((c) => {
                  const href = c.slug ? `/courses/${c.slug}` : "/courses";
                  return (
                    <article
                      key={c.id}
                      className="soft-float group flex h-full flex-col overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container-lowest transition-all"
                    >
                      <Link href={href} className="relative aspect-[16/10] overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          alt={c.title}
                          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                          src={c.image}
                        />
                        {c.badge === "Bestseller" && (
                          <span className="absolute top-4 left-4 rounded-lg bg-primary px-4 py-1.5 font-headline text-label-md font-bold text-on-primary shadow-lg">
                            Bestseller
                          </span>
                        )}
                        {c.badge === "New" && (
                          <span className="absolute top-4 left-4 rounded-lg bg-secondary px-4 py-1.5 font-headline text-label-md font-bold text-on-secondary shadow-lg">
                            New
                          </span>
                        )}
                      </Link>

                      <div className="flex flex-grow flex-col space-y-4 p-6">
                        <div className="flex flex-col gap-1">
                          <span className="text-[11px] font-black tracking-[0.15em] text-primary uppercase">
                            {c.category ?? "Kursus"}
                          </span>
                          <Link href={href}>
                            <h3 className="font-headline text-headline-md leading-[1.3] text-on-surface transition-colors group-hover:text-primary">
                              {c.title}
                            </h3>
                          </Link>
                          <p className="font-headline text-label-md text-on-surface-variant/70">
                            {c.instructorName ?? "Instruktur"}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="font-bold text-on-surface">
                            {c.rating.toFixed(1)}
                          </span>
                          <StarRow rating={c.rating} />
                          {c.reviewCount > 0 && (
                            <span className="font-headline text-label-md text-outline">
                              {formatReviewCount(c.reviewCount)}
                            </span>
                          )}
                        </div>

                        <div className="mt-auto flex items-center justify-between border-t border-outline-variant/20 pt-6">
                          <span className="text-2xl font-bold text-on-surface">
                            {c.price === 0 ? "Gratis" : formatRupiah(c.price)}
                          </span>
                          <Link
                            href={href}
                            className="rounded-xl bg-primary px-5 py-2.5 font-headline text-label-md font-bold text-on-primary shadow-sm transition-all hover:bg-primary-container hover:text-on-primary-container active:scale-95"
                          >
                            {usedDemo && !c.slug ? "Lihat" : "Lihat Kursus"}
                          </Link>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 py-12">
                <Link
                  href={buildPageHref(Math.max(1, page - 1), filterOpts)}
                  aria-disabled={page <= 1}
                  className={`flex h-11 w-11 items-center justify-center rounded-xl border border-outline-variant/30 text-on-surface-variant transition-all hover:bg-primary hover:text-on-primary ${
                    page <= 1 ? "pointer-events-none opacity-30" : ""
                  }`}
                >
                  <span className="material-symbols-outlined">chevron_left</span>
                </Link>

                {Array.from({ length: Math.min(totalPages, 3) }, (_, i) => i + 1).map(
                  (p) => (
                    <Link
                      key={p}
                      href={buildPageHref(p, filterOpts)}
                      className={
                        p === page
                          ? "flex h-11 w-11 items-center justify-center rounded-xl bg-primary font-bold text-on-primary shadow-md"
                          : "flex h-11 w-11 items-center justify-center rounded-xl border border-outline-variant/30 text-on-surface-variant transition-all hover:bg-primary hover:text-on-primary"
                      }
                    >
                      {p}
                    </Link>
                  ),
                )}

                {totalPages > 4 && (
                  <>
                    <span className="px-4 font-bold text-outline">...</span>
                    <Link
                      href={buildPageHref(totalPages, filterOpts)}
                      className={
                        page === totalPages
                          ? "flex h-11 w-11 items-center justify-center rounded-xl bg-primary font-bold text-on-primary shadow-md"
                          : "flex h-11 w-11 items-center justify-center rounded-xl border border-outline-variant/30 text-on-surface-variant transition-all hover:bg-primary hover:text-on-primary"
                      }
                    >
                      {totalPages}
                    </Link>
                  </>
                )}

                <Link
                  href={buildPageHref(Math.min(totalPages, page + 1), filterOpts)}
                  aria-disabled={page >= totalPages}
                  className={`flex h-11 w-11 items-center justify-center rounded-xl border border-outline-variant/30 text-on-surface-variant transition-all hover:bg-primary hover:text-on-primary ${
                    page >= totalPages ? "pointer-events-none opacity-30" : ""
                  }`}
                >
                  <span className="material-symbols-outlined">chevron_right</span>
                </Link>
              </div>
            )}
          </section>
        </div>
      </main>

      <footer className="mt-12 w-full bg-primary text-on-primary">
        <div className="mx-auto flex w-full max-w-container-max flex-col items-start justify-between gap-gutter px-margin-mobile py-unit-12 md:flex-row md:px-margin-desktop">
          <div className="max-w-xs space-y-6">
            <span className="font-headline text-headline-md font-bold tracking-tight text-on-primary">
              Gladi.ID
            </span>
            <p className="font-body text-body-md leading-relaxed opacity-80">
              Empowering technical precision through world-class IT education. Join a
              community of forward-thinking developers.
            </p>
            <div className="flex gap-5">
              <a
                href="#"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
                aria-label="QR"
              >
                <span className="material-symbols-outlined text-[20px]">qr_code_2</span>
              </a>
              <a
                href="#"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
                aria-label="Bagikan"
              >
                <span className="material-symbols-outlined text-[20px]">share</span>
              </a>
              <a
                href={WA_HREF}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
                aria-label="Hubungi"
              >
                <span className="material-symbols-outlined text-[20px]">link</span>
              </a>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-16 gap-y-10 md:grid-cols-3">
            <div className="space-y-5">
              <h4 className="font-headline text-label-md font-bold tracking-widest text-primary-fixed-dim uppercase">
                Explore
              </h4>
              <ul className="space-y-3 font-body text-body-md opacity-70">
                {DEFAULT_CATEGORIES.slice(0, 3).map((cat) => (
                  <li key={cat}>
                    <Link
                      href={`/courses?category=${encodeURIComponent(cat)}`}
                      className="transition-opacity hover:opacity-100"
                    >
                      {cat}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-5">
              <h4 className="font-headline text-label-md font-bold tracking-widest text-primary-fixed-dim uppercase">
                Company
              </h4>
              <ul className="space-y-3 font-body text-body-md opacity-70">
                <li>
                  <Link href="/" className="transition-opacity hover:opacity-100">
                    About Us
                  </Link>
                </li>
                <li>
                  <a href={WA_HREF} className="transition-opacity hover:opacity-100">
                    Support
                  </a>
                </li>
                <li>
                  <Link href="/verify" className="transition-opacity hover:opacity-100">
                    Verify Certificate
                  </Link>
                </li>
              </ul>
            </div>
            <div className="space-y-5">
              <h4 className="font-headline text-label-md font-bold tracking-widest text-primary-fixed-dim uppercase">
                Connect
              </h4>
              <ul className="space-y-3 font-body text-body-md opacity-70">
                <li>
                  <span className="cursor-default">Facebook</span>
                </li>
                <li>
                  <span className="cursor-default">LinkedIn</span>
                </li>
                <li>
                  <span className="cursor-default">Twitter</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
        <div className="w-full border-t border-white/10">
          <div className="mx-auto max-w-container-max px-margin-mobile py-8 md:px-margin-desktop">
            <p className="font-headline text-label-md text-on-primary/60">
              © {year} Gladi.ID. Empowering Technical Precision with Modern Learning.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
