import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { courses, transactions, users } from "@/db/schema";
import { requireRole } from "@/lib/guards";
import { formatRupiah } from "@/lib/courses";

export const dynamic = "force-dynamic";

/**
 * Daftar semua transaksi (admin) — untuk rekonsiliasi & support.
 */
export default async function AdminTransactionsPage() {
  await requireRole(["admin"]);

  const rows = await db
    .select({
      id: transactions.id,
      amount: transactions.amount,
      status: transactions.status,
      gateway: transactions.paymentGateway,
      ref: transactions.gatewayRef,
      method: transactions.paymentMethod,
      createdAt: transactions.createdAt,
      paidAt: transactions.paidAt,
      courseTitle: courses.title,
      userEmail: users.email,
    })
    .from(transactions)
    .leftJoin(courses, eq(transactions.courseId, courses.id))
    .leftJoin(users, eq(transactions.userId, users.id))
    .orderBy(desc(transactions.createdAt))
    .limit(100);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="mb-8 text-2xl font-bold text-white">Transaksi ({rows.length} terbaru)</h1>

      <div className="overflow-x-auto rounded-xl border border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-800 bg-zinc-900 text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-4 py-3">Order Ref</th>
              <th className="px-4 py-3">Kursus</th>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Jumlah</th>
              <th className="px-4 py-3">Metode</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Waktu</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800 bg-zinc-950">
            {rows.map((t) => (
              <tr key={t.id}>
                <td className="px-4 py-3 font-mono text-xs text-zinc-400">{t.ref}</td>
                <td className="px-4 py-3 text-white">{t.courseTitle ?? "-"}</td>
                <td className="px-4 py-3 text-zinc-400">{t.userEmail}</td>
                <td className="px-4 py-3 text-white">{formatRupiah(t.amount)}</td>
                <td className="px-4 py-3 text-zinc-400">{t.method ?? "-"}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={t.status} />
                </td>
                <td className="px-4 py-3 text-xs text-zinc-500">
                  {new Date(t.createdAt).toLocaleString("id-ID")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    paid: "bg-emerald-600/20 text-emerald-400",
    pending: "bg-amber-600/20 text-amber-400",
    failed: "bg-red-600/20 text-red-400",
    expired: "bg-zinc-600/20 text-zinc-400",
    refunded: "bg-sky-600/20 text-sky-400",
  };
  return (
    <span className={`rounded px-2 py-0.5 text-[10px] font-semibold ${map[status] ?? map.pending}`}>
      {status}
    </span>
  );
}
