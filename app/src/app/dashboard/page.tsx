import Link from "next/link";
import { redirect } from "next/navigation";

import { auth, signOut } from "@/auth";

/**
 * Halaman dashboard terproteksi — hanya bisa diakses setelah login.
 * Link role-aware ke panel Admin / Instruktur (PRD §13 A4).
 */
export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = session.user.role;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-zinc-950 px-6 text-center">
      <h1 className="text-3xl font-bold text-white">Dashboard</h1>
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-left text-zinc-300">
        <p><span className="text-zinc-500">Nama:</span> {session.user.name ?? "—"}</p>
        <p><span className="text-zinc-500">Email:</span> {session.user.email}</p>
        <p>
          <span className="text-zinc-500">Role:</span>{" "}
          <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-emerald-400">
            {role}
          </span>
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/courses"
          className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
        >
          Katalog Kursus
        </Link>
        <Link
          href="/dashboard/certificates"
          className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
        >
          Sertifikat Saya
        </Link>
        {(role === "instructor" || role === "admin") && (
          <Link
            href="/instructor/dashboard"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
          >
            Panel Instruktur
          </Link>
        )}
        {role === "admin" && (
          <Link
            href="/admin"
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500"
          >
            Panel Admin
          </Link>
        )}
      </div>

      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/" });
        }}
      >
        <button className="rounded-lg border border-zinc-700 px-4 py-2 text-zinc-200 hover:bg-zinc-800">
          Keluar
        </button>
      </form>
    </div>
  );
}
