import { auth } from "@/auth";

/**
 * Halaman contoh khusus admin — membuktikan RBAC role-based (bukan sekadar login).
 */
export default async function AdminPage() {
  const session = await auth();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-950 px-6 text-center">
      <h1 className="text-3xl font-bold text-white">Area Admin</h1>
      <p className="text-zinc-400">
        Hanya role <code className="text-emerald-400">admin</code> yang bisa melihat halaman ini.
        Role Anda: <code className="text-emerald-400">{session?.user?.role}</code>
      </p>
    </div>
  );
}
