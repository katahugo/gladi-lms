import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/users", label: "User" },
  { href: "/admin/transactions", label: "Transaksi" },
  { href: "/admin/coupons", label: "Kupon" },
] as const;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/");

  return (
    <div className="flex min-h-[calc(100vh-1px)]">
      <aside className="flex w-56 shrink-0 flex-col border-r border-zinc-800 bg-zinc-900">
        <div className="border-b border-zinc-800 px-5 py-4">
          <p className="text-sm font-semibold text-white">Admin Panel</p>
          <p className="mt-0.5 text-xs text-zinc-500">{session.user.email}</p>
        </div>

        <nav className="flex-1 space-y-0.5 px-3 py-4">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-lg px-3 py-2 text-sm text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="border-t border-zinc-800 px-3 py-4">
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
