"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type AdminNavLinkProps = {
  href: string;
  label: string;
  icon: string;
  exact?: boolean;
};

/**
 * Nav item sidebar admin — highlight aktif sesuai pathname.
 */
export function AdminNavLink({ href, label, icon, exact }: AdminNavLinkProps) {
  const pathname = usePathname();
  const active = exact
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={`flex items-center gap-unit-3 rounded-lg px-unit-4 py-3 transition-all active:scale-95 ${
        active
          ? "bg-primary-container font-bold text-on-primary-container"
          : "text-on-surface-variant hover:bg-surface-container-highest"
      }`}
    >
      <span className="material-symbols-outlined">{icon}</span>
      <span className="font-headline text-label-md">{label}</span>
    </Link>
  );
}
