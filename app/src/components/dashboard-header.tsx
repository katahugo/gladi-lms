"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type DashboardHeaderProps = {
  user: {
    name?: string | null;
    image?: string | null;
  };
};

/**
 * Header dashboard siswa — search ke katalog, profil ke dashboard.
 */
export function DashboardHeader({ user }: DashboardHeaderProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  function onSearch(e: FormEvent) {
    e.preventDefault();
    const q = query.trim();
    router.push(q ? `/courses?q=${encodeURIComponent(q)}` : "/courses");
  }

  return (
    <header className="sticky top-0 z-50 border-b border-outline-variant bg-surface-container-lowest shadow-sm">
      <div className="mx-auto flex w-full max-w-container-max items-center justify-between px-margin-mobile py-4 md:px-margin-desktop">
        <div className="flex items-center gap-8">
          <Link
            href="/"
            className="font-headline text-headline-md font-bold text-primary"
          >
            Gladi.ID
          </Link>
          <nav className="hidden items-center gap-6 md:flex">
            <Link
              href="/courses"
              className="font-body text-body-md text-on-surface-variant transition-colors hover:text-primary"
            >
              Kategori
            </Link>
            <Link
              href="/dashboard"
              className="border-b-2 border-primary pb-1 font-body text-body-md font-bold text-primary"
            >
              Kursus Saya
            </Link>
          </nav>
        </div>

        <form onSubmit={onSearch} className="mx-4 hidden max-w-md flex-1 md:mx-8 md:flex">
          <div className="relative w-full">
            <span className="material-symbols-outlined absolute top-1/2 left-3 -translate-y-1/2 text-outline">
              search
            </span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari kursus, keahlian, atau mentor..."
              className="font-headline text-label-md w-full rounded-full border border-outline-variant bg-surface-container-low py-2 pr-4 pl-10 outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-primary"
            />
          </div>
        </form>

        <div className="flex items-center gap-4">
          <button
            type="button"
            className="relative rounded-full p-2 text-on-surface-variant transition-all hover:bg-surface-container-high"
            aria-label="Notifikasi"
          >
            <span className="material-symbols-outlined">notifications</span>
            <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-error" />
          </button>
          <div className="h-10 w-10 overflow-hidden rounded-full border border-outline-variant">
            {user.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt={user.name ?? "Profil"}
                className="h-full w-full object-cover"
                src={user.image}
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center bg-primary-fixed text-sm font-semibold text-on-primary-fixed">
                {(user.name ?? "S").charAt(0).toUpperCase()}
              </span>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
