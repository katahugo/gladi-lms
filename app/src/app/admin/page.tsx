import Link from "next/link";
import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { courses, transactions, users } from "@/db/schema";
import { requireRole } from "@/lib/guards";
import { getAdminStats } from "@/lib/reports";
import { formatRupiah } from "@/lib/courses";

export const dynamic = "force-dynamic";

/**
 * Dashboard admin (E3) — statistik global platform + manajemen user +
 * daftar transaksi terkini.
 */
export default async function AdminDashboard() {
  await requireRole(["admin"]);
  const stats = await getAdminStats();

  const recentUsers = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt))
    .limit(8);

  const recentTx = await db
    .select({
      id: transactions.id,
      amount: transactions.amount,
      status: transactions.status,
      gateway: transactions.paymentGateway,
      ref: transactions.gatewayRef,
      createdAt: transactions.createdAt,
      courseTitle: courses.title,
      userEmail: users.email,
    })
    .from(transactions)
    .leftJoin(courses, eq(transactions.courseId, courses.id))
    .leftJoin(users, eq(transactions.userId, users.id))
    .orderBy(desc(transactions.createdAt))
    .limit(10);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="mb-8 text-2xl font-bold text-white">Dashboard Admin</h1>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="User" value={String(stats.totalUsers)} sub={`${stats.instructorCount} instruktur`} />
        <StatCard label="Kursus" value={String(stats.totalCourses)} sub={`${stats.publishedCourses} terbit`} />
        <StatCard label="Enrollment" value={String(stats.totalEnrollments)} sub={`${stats.totalStudents} siswa unik`} />
        <StatCard label="Sertifikat" value={String(stats.totalCertificates)} sub="Terbit" />
        <StatCard label="Pendapatan" value={formatRupiah(stats.revenue)} sub={`${stats.transactionCount} transaksi paid`} />
        <StatCard label="Transaksi Pending" value={String(stats.pendingTransactions)} sub="Menunggu pembayaran" />
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-white">User Terbaru</h2>
            <Link href="/admin/users" className="text-xs text-emerald-400 hover:underline">
              Kelola semua
            </Link>
          </div>
          {recentUsers.length === 0 ? (
            <p className="text-sm text-zinc-500">Belum ada user.</p>
          ) : (
            <ul className="space-y-2">
              {recentUsers.map((u) => (
                <li key={u.id} className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm">
                  <p className="font-medium text-white">{u.name ?? "-"}</p>
                  <p className="text-xs text-zinc-500">
                    {u.email} · {u.role} · {new Date(u.createdAt).toLocaleDateString("id-ID")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-white">Transaksi Terkini</h2>
            <Link href="/admin/transactions" className="text-xs text-emerald-400 hover:underline">
              Lihat semua
            </Link>
          </div>
          {recentTx.length === 0 ? (
            <p className="text-sm text-zinc-500">Belum ada transaksi.</p>
          ) : (
            <ul className="space-y-2">
              {recentTx.map((t) => (
                <li key={t.id} className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-white">{formatRupiah(t.amount)}</p>
                    <StatusBadge status={t.status} />
                  </div>
                  <p className="text-xs text-zinc-500">
                    {t.courseTitle ?? "-"} · {t.userEmail} · {t.gateway}/{t.ref}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-white">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-zinc-500">{sub}</p>}
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
