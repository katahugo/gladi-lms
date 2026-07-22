import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";

/**
 * Halaman dashboard terproteksi — hanya bisa diakses setelah login.
 * Membuktikan middleware RBAC + session berjalan.
 */
export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-zinc-950 px-6 text-center">
      <h1 className="text-3xl font-bold text-white">Dashboard</h1>
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-left text-zinc-300">
        <p><span className="text-zinc-500">Nama:</span> {session.user.name ?? "—"}</p>
        <p><span className="text-zinc-500">Email:</span> {session.user.email}</p>
        <p>
          <span className="text-zinc-500">Role:</span>{" "}
          <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-emerald-400">
            {session.user.role}
          </span>
        </p>
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
