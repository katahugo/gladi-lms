import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { PanelNavLink } from "@/components/panel-nav-link";

const NAV_ITEMS = [
  { href: "/instructor/dashboard", label: "Dashboard" },
  { href: "/instructor/courses", label: "Kursus Saya" },
] as const;

/**
 * Shell panel instruktur (PRD §13 F0) — sidebar + proteksi role.
 * Admin juga diizinkan (support / oversight).
 */
export default async function InstructorLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "instructor" && session.user.role !== "admin") redirect("/");

  return (
    <div className="flex min-h-[calc(100vh-1px)]">
      <aside className="flex w-56 shrink-0 flex-col border-r border-zinc-800 bg-zinc-900">
        <div className="border-b border-zinc-800 px-5 py-4">
          <p className="text-sm font-semibold text-white">Panel Instruktur</p>
          <p className="mt-0.5 text-xs text-zinc-500">{session.user.email}</p>
          {session.user.role === "admin" && (
            <p className="mt-1 text-[10px] uppercase tracking-wide text-amber-500/80">Mode admin</p>
          )}
        </div>

        <nav className="flex-1 space-y-0.5 px-3 py-4">
          {NAV_ITEMS.map((item) => (
            <PanelNavLink key={item.href} href={item.href} label={item.label} />
          ))}
        </nav>

        <div className="space-y-0.5 border-t border-zinc-800 px-3 py-4">
          {session.user.role === "admin" && (
            <Link
              href="/admin"
              className="block rounded-lg px-3 py-2 text-sm text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
            >
              Panel Admin
            </Link>
          )}
          <Link
            href="/"
            className="block rounded-lg px-3 py-2 text-sm text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
          >
            Kembali ke Situs
          </Link>
        </div>
      </aside>

      <main className="flex-1 overflow-x-hidden">{children}</main>
    </div>
  );
}
