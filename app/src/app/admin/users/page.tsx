import { desc } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";
import { requireRole } from "@/lib/guards";
import { UserRoleSelect } from "./user-role-select";

export const dynamic = "force-dynamic";

/**
 * Manajemen user (admin) — daftar semua user + ubah role.
 */
export default async function AdminUsersPage() {
  const me = await requireRole(["admin"]);

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      emailVerified: users.emailVerified,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt));

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="mb-8 text-2xl font-bold text-white">Manajemen User ({rows.length})</h1>

      <div className="overflow-x-auto rounded-xl border border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-800 bg-zinc-900 text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-4 py-3">Nama</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Terdaftar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800 bg-zinc-950">
            {rows.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-3 text-white">{u.name ?? "-"}</td>
                <td className="px-4 py-3 text-zinc-400">{u.email}</td>
                <td className="px-4 py-3">
                  <UserRoleSelect userId={u.id} currentRole={u.role} isSelf={u.id === me.id} />
                </td>
                <td className="px-4 py-3 text-zinc-500">
                  {new Date(u.createdAt).toLocaleDateString("id-ID")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
