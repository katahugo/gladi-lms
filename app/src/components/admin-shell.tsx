"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";

import { AdminNavLink } from "@/components/admin-nav-link";

const NAV = [
  { href: "/admin", label: "Ringkasan", icon: "dashboard", exact: true },
  { href: "/instructor/courses", label: "Kursus", icon: "menu_book" },
  { href: "/admin/users", label: "Pengguna", icon: "group" },
  { href: "/admin/transactions", label: "Pendapatan", icon: "payments" },
  { href: "/admin#kesehatan", label: "Kesehatan Sistem", icon: "analytics", exact: true },
  { href: "/admin/coupons", label: "Pengaturan", icon: "settings_suggest" },
] as const;

type AdminShellProps = {
  children: ReactNode;
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  logoutAction: () => Promise<void>;
};

/**
 * Shell admin: sidebar + top bar sesuai mockup Admin LMS.
 */
export function AdminShell({ children, user, logoutAction }: AdminShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const displayName = user.name?.trim() || "Admin Utama";
  const avatar =
    user.image ||
    "https://lh3.googleusercontent.com/aida-public/AB6AXuBCrNcGd_Z3VIzyrOmEvE_F6aijtNt7kJblaPmNrP3Z3LR0bhMdqbLqgjoE_fnpM9IJiFtg9cytEE2hRy2DkrnX-egM13FnKCC9cWHrj07bDA59TmAAdiOlMJkS1FsSmik14JDiSrBAMbZflZ-MrUA_faK6RcVBQnMqezx2jmDttv1QdNmRdMsEmfcrCk0p-EPh5ExM3awJFGaHx-4vzPmXZAaj0LtjHfaPHSGf4uhUnRLQzhLJ81PL25vfYhYCcmXL2wdxxu3o8g4";

  return (
    <div className="min-h-screen bg-background font-body text-on-surface">
      {mobileOpen && (
        <button
          type="button"
          aria-label="Tutup menu"
          className="fixed inset-0 z-40 bg-on-surface/30 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed top-0 left-0 z-50 flex h-full w-64 flex-col border-r border-outline-variant bg-surface-container-low px-unit-4 py-unit-6 transition-transform md:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-unit-8 flex items-center gap-unit-3 px-unit-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-on-primary">
            <span
              className="material-symbols-outlined"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              terminal
            </span>
          </div>
          <div>
            <h2 className="font-headline text-headline-md leading-tight font-black text-primary">
              Admin LMS
            </h2>
            <p className="text-[10px] font-bold tracking-widest text-on-surface-variant uppercase">
              Status: Aktif
            </p>
          </div>
        </div>

        <nav className="flex-1 space-y-1" onClick={() => setMobileOpen(false)}>
          {NAV.map((item) => (
            <AdminNavLink
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              exact={"exact" in item ? item.exact : false}
            />
          ))}
        </nav>

        <div className="mt-auto space-y-4 border-t border-outline-variant pt-unit-6">
          <Link
            href="/instructor/courses/new"
            className="tech-shadow flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-bold text-on-primary transition-all hover:opacity-90 active:scale-95"
            onClick={() => setMobileOpen(false)}
          >
            <span className="material-symbols-outlined text-sm">add</span>
            <span className="font-headline text-label-md">Buat Kursus Baru</span>
          </Link>
          <form action={logoutAction}>
            <button
              type="submit"
              className="flex w-full items-center gap-unit-3 rounded-lg px-unit-4 py-3 text-error transition-all hover:bg-error-container/20"
            >
              <span className="material-symbols-outlined">logout</span>
              <span className="font-headline text-label-md">Keluar</span>
            </button>
          </form>
        </div>
      </aside>

      <main className="flex min-h-screen flex-col md:ml-64">
        <header className="fixed top-0 right-0 z-40 flex h-16 items-center justify-between border-b border-outline-variant bg-surface px-6 shadow-sm md:left-64 md:px-margin-desktop">
          <div className="flex items-center gap-4">
            <button
              type="button"
              className="cursor-pointer text-on-surface md:hidden"
              aria-label="Buka menu"
              onClick={() => setMobileOpen(true)}
            >
              <span className="material-symbols-outlined">menu</span>
            </button>
            <h1 className="font-headline text-headline-md font-bold text-primary">
              Dashboard Gladi.ID
            </h1>
          </div>

          <div className="flex items-center gap-unit-6">
            <div className="hidden items-center rounded-full border border-outline-variant bg-surface-container px-4 py-2 transition-all focus-within:border-primary lg:flex">
              <span className="material-symbols-outlined text-sm text-on-surface-variant">
                search
              </span>
              <input
                className="w-48 border-none bg-transparent text-label-md text-on-surface outline-none focus:ring-0"
                placeholder="Cari data..."
                type="search"
                aria-label="Cari data"
              />
            </div>
            <div className="flex items-center gap-4">
              <button
                type="button"
                className="relative text-on-surface-variant transition-colors hover:text-primary"
                aria-label="Notifikasi"
              >
                <span className="material-symbols-outlined">notifications</span>
                <span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-error" />
              </button>
              <Link
                href="/admin/coupons"
                className="text-on-surface-variant transition-colors hover:text-primary"
                aria-label="Pengaturan"
              >
                <span className="material-symbols-outlined">settings</span>
              </Link>
              <div className="mx-2 hidden h-8 w-px bg-outline-variant sm:block" />
              <div className="flex cursor-default items-center gap-3">
                <div className="hidden text-right sm:block">
                  <p className="text-label-md leading-none font-bold text-on-surface">
                    {displayName}
                  </p>
                  <p className="text-[11px] text-on-surface-variant">Superuser</p>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className="h-10 w-10 rounded-full border-2 border-primary object-cover"
                  alt=""
                  src={avatar}
                />
              </div>
            </div>
          </div>
        </header>

        <div className="mt-16 flex-1">{children}</div>
      </main>

      <Link
        href="/instructor/courses/new"
        className="group fixed right-8 bottom-8 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-on-primary shadow-lg transition-all hover:scale-110 active:scale-95"
        aria-label="Buat kursus baru"
      >
        <span className="material-symbols-outlined transition-transform group-hover:rotate-90">
          add
        </span>
      </Link>
    </div>
  );
}
