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
    <div className="mx-auto max-w-5xl p-6 md:p-margin-desktop">
      <h1 className="mb-8 font-headline text-headline-md font-bold text-primary">
        Manajemen User ({rows.length})
      </h1>

      <div className="tech-shadow overflow-x-auto rounded-xl border border-outline-variant bg-surface-container-lowest">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-outline-variant bg-surface-container text-[11px] tracking-widest text-on-surface-variant uppercase">
            <tr>
              <th className="px-4 py-3">Nama</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Terdaftar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/30">
            {rows.map((u) => (
              <tr key={u.id} className="hover:bg-surface-container/30">
                <td className="px-4 py-3 font-medium text-on-surface">{u.name ?? "-"}</td>
                <td className="px-4 py-3 text-on-surface-variant">{u.email}</td>
                <td className="px-4 py-3">
                  <UserRoleSelect userId={u.id} currentRole={u.role} isSelf={u.id === me.id} />
                </td>
                <td className="px-4 py-3 text-on-surface-variant">
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
