"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type SiteHeaderProps = {
  user?: {
    name?: string | null;
    image?: string | null;
  } | null;
  /** Menu aktif di navigasi. */
  active?: "categories" | "my-courses";
  /** Nilai awal search bar (dari query string). */
  initialQuery?: string;
};

/**
 * Navigasi publik Gladi.ID — dipakai landing & katalog kursus.
 */
export function LandingHeader({
  user,
  active = "categories",
  initialQuery = "",
}: SiteHeaderProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);

  function onSearch(e: FormEvent) {
    e.preventDefault();
    const q = query.trim();
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    const qs = params.toString();
    router.push(qs ? `/courses?${qs}` : "/courses");
  }

  return (
    <header className="sticky top-0 z-50 border-b border-outline-variant/30 bg-surface-container-lowest">
      <nav className="mx-auto flex w-full max-w-container-max items-center justify-between px-margin-mobile py-4 md:px-margin-desktop">
        <div className="flex items-center gap-8 md:gap-10">
          <Link
            href="/"
            className="font-headline text-headline-md font-bold tracking-tight text-primary"
          >
            Gladi.ID
          </Link>
          <div className="hidden items-center gap-8 font-headline text-label-md md:flex">
            <Link
              href="/courses"
              className={
                active === "categories"
                  ? "border-b-2 border-primary pb-1 font-bold text-primary"
                  : "text-on-surface-variant transition-colors hover:text-primary"
              }
            >
              Categories
            </Link>
            <Link
              href={user ? "/dashboard" : "/login"}
              className={
                active === "my-courses"
                  ? "border-b-2 border-primary pb-1 font-bold text-primary"
                  : "text-on-surface-variant transition-colors hover:text-primary"
              }
            >
              My Courses
            </Link>
          </div>
        </div>

        <form
          onSubmit={onSearch}
          className="mx-4 hidden max-w-lg flex-1 md:mx-12 md:flex"
        >
          <div className="relative w-full">
            <span className="material-symbols-outlined absolute top-1/2 left-4 -translate-y-1/2 text-outline">
              search
            </span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for courses or skills..."
              className="text-body-md w-full rounded-xl border-none bg-surface-container-low py-2.5 pr-4 pl-12 transition-all placeholder:text-outline focus:ring-2 focus:ring-primary/20 focus:outline-none"
            />
          </div>
        </form>

        <div className="flex items-center gap-4 md:gap-5">
          {user ? (
            <>
              <button
                type="button"
                className="relative rounded-full p-2.5 transition-colors hover:bg-surface-container-low"
                aria-label="Notifikasi"
              >
                <span className="material-symbols-outlined text-on-surface-variant">
                  notifications
                </span>
                <span className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-primary-container" />
              </button>
              <Link
                href="/dashboard"
                className="h-10 w-10 cursor-pointer overflow-hidden rounded-full border-2 border-primary/10 transition-colors hover:border-primary"
                aria-label="Profil"
              >
                {user.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    alt={user.name ?? "User Profile"}
                    className="h-full w-full object-cover"
                    src={user.image}
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center bg-primary-fixed text-sm font-semibold text-on-primary-fixed">
                    {(user.name ?? "U").charAt(0).toUpperCase()}
                  </span>
                )}
              </Link>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-xl bg-primary px-4 py-2.5 font-headline text-label-md font-bold text-on-primary transition-all hover:bg-primary-container hover:text-on-primary-container"
            >
              Masuk
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
