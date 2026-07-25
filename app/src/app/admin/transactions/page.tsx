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
    <div className="mx-auto max-w-6xl p-6 md:p-margin-desktop">
      <h1 className="mb-8 font-headline text-headline-md font-bold text-primary">
        Transaksi ({rows.length} terbaru)
      </h1>

      <div className="tech-shadow overflow-x-auto rounded-xl border border-outline-variant bg-surface-container-lowest">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-outline-variant bg-surface-container text-[11px] tracking-widest text-on-surface-variant uppercase">
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
          <tbody className="divide-y divide-outline-variant/30">
            {rows.map((t) => (
              <tr key={t.id} className="hover:bg-surface-container/30">
                <td className="px-4 py-3 font-mono text-xs text-on-surface-variant">{t.ref}</td>
                <td className="px-4 py-3 font-medium text-on-surface">{t.courseTitle ?? "-"}</td>
                <td className="px-4 py-3 text-on-surface-variant">{t.userEmail}</td>
                <td className="px-4 py-3 font-medium text-on-surface">{formatRupiah(t.amount)}</td>
                <td className="px-4 py-3 text-on-surface-variant">{t.method ?? "-"}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={t.status} />
                </td>
                <td className="px-4 py-3 text-xs text-on-surface-variant">
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
    paid: "bg-primary-container/40 text-on-primary-container",
    pending: "bg-tertiary-container/50 text-on-tertiary-container",
    failed: "bg-error-container text-on-error-container",
    expired: "bg-surface-container text-on-surface-variant",
    refunded: "bg-secondary-container text-on-secondary-container",
  };
  return (
    <span
      className={`rounded px-2 py-0.5 text-[10px] font-semibold ${map[status] ?? map.pending}`}
    >
      {status}
    </span>
  );
}
