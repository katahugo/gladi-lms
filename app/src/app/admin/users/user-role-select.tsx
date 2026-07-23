"use client";

import { useState } from "react";

const ROLES = ["student", "instructor", "admin", "support"] as const;

/**
 * Dropdown ubah role user (admin). Admin tidak bisa mengubah role dirinya
 * sendiri (mencegah lockout).
 */
export function UserRoleSelect({
  userId,
  currentRole,
  isSelf,
}: {
  userId: string;
  currentRole: string;
  isSelf: boolean;
}) {
  const [role, setRole] = useState(currentRole);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function change(next: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: next }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Gagal mengubah role");
      setRole(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <select
        value={role}
        onChange={(e) => change(e.target.value)}
        disabled={busy || isSelf}
        className="rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-white disabled:opacity-50"
        title={isSelf ? "Tidak bisa mengubah role sendiri" : undefined}
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-[10px] text-red-400">{error}</p>}
    </div>
  );
}
