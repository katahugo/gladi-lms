"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type LandingHeaderProps = {
  user?: {
    name?: string | null;
    image?: string | null;
  } | null;
};

/**
 * Navigasi landing — search ke katalog, akun ke dashboard/login.
 */
export function LandingHeader({ user }: LandingHeaderProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  function onSearch(e: FormEvent) {
    e.preventDefault();
    const q = query.trim();
    router.push(q ? `/courses?q=${encodeURIComponent(q)}` : "/courses");
  }

  return (
    <header className="fixed top-0 right-0 left-0 z-50 border-b border-outline-variant bg-surface-container-lowest shadow-sm">
      <nav className="mx-auto flex w-full max-w-container-max items-center justify-between px-margin-mobile py-4 md:px-margin-desktop">
        <div className="flex items-center gap-8">
          <Link href="/" className="font-headline text-headline-md font-bold text-primary">
            Gladi.ID
          </Link>
          <div className="hidden gap-6 md:flex">
            <Link
              href="/courses"
              className="border-b-2 border-primary pb-1 font-body text-body-md font-bold text-primary transition-colors hover:text-primary"
            >
              Categories
            </Link>
            <Link
              href={user ? "/dashboard" : "/login"}
              className="font-body text-body-md text-on-surface-variant transition-colors hover:text-primary"
            >
              My Courses
            </Link>
          </div>
        </div>

        <form
          onSubmit={onSearch}
          className="mx-2 hidden max-w-xl flex-1 justify-end px-4 sm:flex md:px-8"
        >
          <div className="relative w-full transition-transform focus-within:scale-[1.02]">
            <span className="material-symbols-outlined absolute top-1/2 left-3 -translate-y-1/2 text-outline">
              search
            </span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari kursus IT..."
              className="text-body-md w-full rounded-full border border-outline-variant bg-surface-container-low py-2 pr-4 pl-10 outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>
        </form>

        <div className="flex items-center gap-4">
          {user ? (
            <>
              <button
                type="button"
                className="material-symbols-outlined text-on-surface-variant transition-colors hover:text-primary"
                aria-label="Notifikasi"
              >
                notifications
              </button>
              <Link
                href="/dashboard"
                className="h-10 w-10 overflow-hidden rounded-full border border-outline-variant"
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
              className="rounded-lg bg-primary px-4 py-2 font-headline text-label-md text-on-primary transition-all hover:brightness-110"
            >
              Masuk
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
