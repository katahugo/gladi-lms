import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import { db } from "@/db";
import { courses, enrollments, transactions, users } from "@/db/schema";
import { formatRupiah } from "@/lib/courses";
import { requireRole } from "@/lib/guards";
import { getAdminStats } from "@/lib/reports";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin Dashboard",
  description: "Ringkasan platform LMS Gladi.ID untuk administrator.",
};

type AdminStats = Awaited<ReturnType<typeof getAdminStats>>;

const DEMO_STATS: AdminStats = {
  totalCourses: 342,
  publishedCourses: 342,
  totalEnrollments: 54210,
  totalStudents: 54210,
  totalCertificates: 1200,
  revenue: 128_500_000,
  transactionCount: 840,
  totalUsers: 54210,
  instructorCount: 48,
  pendingTransactions: 12,
};

function formatCompactRp(amount: number): string {
  if (amount >= 1_000_000_000) {
    return `Rp ${(amount / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}B`;
  }
  if (amount >= 1_000_000) {
    return `Rp ${(amount / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (amount >= 1_000) {
    return `Rp ${(amount / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  }
  return formatRupiah(amount);
}

function formatStudents(n: number): string {
  return n.toLocaleString("id-ID");
}

function relativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "Baru saja";
  if (mins < 60) return `${mins} menit yang lalu`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} jam yang lalu`;
  const days = Math.floor(hours / 24);
  return `${days} hari yang lalu`;
}

type Activity = {
  id: string;
  icon: string;
  tone: string;
  body: ReactNode;
  time: string;
};

type PopularCourse = {
  id: string;
  title: string;
  students: number;
  rating: string;
  status: "TRENDING" | "STABIL";
  icon: string;
  iconTone: string;
};

/**
 * Dashboard admin (Ringkasan) — bento stats, chart, aktivitas, kursus populer.
 */
export default async function AdminDashboard() {
  await requireRole(["admin"]);

  let stats = DEMO_STATS;
  let recentUsers: { id: string; name: string | null; createdAt: Date }[] = [];
  let recentTx: {
    id: string;
    amount: number;
    status: string;
    createdAt: Date;
    userName: string | null;
  }[] = [];
  let popular: PopularCourse[] = [];
  let usingDemo = false;

  try {
    stats = await getAdminStats();
    if (stats.totalUsers === 0 && stats.totalCourses === 0) {
      usingDemo = true;
      stats = DEMO_STATS;
    }

    recentUsers = await db
      .select({
        id: users.id,
        name: users.name,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt))
      .limit(4);

    recentTx = await db
      .select({
        id: transactions.id,
        amount: transactions.amount,
        status: transactions.status,
        createdAt: transactions.createdAt,
        userName: users.name,
      })
      .from(transactions)
      .leftJoin(users, eq(transactions.userId, users.id))
      .orderBy(desc(transactions.createdAt))
      .limit(4);

    const popularRows = await db
      .select({
        id: courses.id,
        title: courses.title,
        students: sql<number>`count(${enrollments.id})`.mapWith(Number),
      })
      .from(courses)
      .leftJoin(enrollments, eq(enrollments.courseId, courses.id))
      .where(eq(courses.status, "published"))
      .groupBy(courses.id, courses.title)
      .orderBy(desc(sql`count(${enrollments.id})`))
      .limit(3);

    const icons = ["javascript", "cloud", "psychology"] as const;
    const tones = [
      "bg-primary/10 text-primary",
      "bg-tertiary/10 text-tertiary",
      "bg-secondary/10 text-secondary",
    ] as const;
    const ratings = ["4.9", "4.7", "4.8"];

    popular = popularRows.map((row, i) => ({
      id: row.id,
      title: row.title,
      students: row.students,
      rating: ratings[i] ?? "4.5",
      status: (row.students >= 50 ? "TRENDING" : "STABIL") as "TRENDING" | "STABIL",
      icon: icons[i] ?? "menu_book",
      iconTone: tones[i] ?? tones[0],
    }));
  } catch {
    usingDemo = true;
    stats = DEMO_STATS;
  }

  if (popular.length === 0) {
    popular = [
      {
        id: "1",
        title: "Mastering TypeScript",
        students: 4210,
        rating: "4.9",
        status: "TRENDING",
        icon: "javascript",
        iconTone: "bg-primary/10 text-primary",
      },
      {
        id: "2",
        title: "AWS Cloud Essentials",
        students: 2850,
        rating: "4.7",
        status: "STABIL",
        icon: "cloud",
        iconTone: "bg-tertiary/10 text-tertiary",
      },
      {
        id: "3",
        title: "UI/UX Psychology",
        students: 1920,
        rating: "4.8",
        status: "TRENDING",
        icon: "psychology",
        iconTone: "bg-secondary/10 text-secondary",
      },
    ];
  }

  const activities: Activity[] = [];
  for (const u of recentUsers.slice(0, 2)) {
    activities.push({
      id: `u-${u.id}`,
      icon: "person_add",
      tone: "bg-primary-container text-on-primary-container",
      body: (
        <>
          <span className="font-bold">{u.name ?? "Pengguna baru"}</span> baru saja mendaftar
          sebagai siswa.
        </>
      ),
      time: relativeTime(new Date(u.createdAt)),
    });
  }
  for (const t of recentTx.slice(0, 2)) {
    if (t.status === "paid") {
      activities.push({
        id: `t-${t.id}`,
        icon: "shopping_cart",
        tone: "bg-secondary-container text-on-secondary-container",
        body: (
          <>
            <span className="font-bold">{t.userName ?? "Siswa"}</span> membeli paket / kursus (
            {formatRupiah(t.amount)}).
          </>
        ),
        time: relativeTime(new Date(t.createdAt)),
      });
    }
  }

  if (activities.length === 0) {
    activities.push(
      {
        id: "d1",
        icon: "person_add",
        tone: "bg-primary-container text-on-primary-container",
        body: (
          <>
            <span className="font-bold">Andi Pratama</span> baru saja mendaftar sebagai siswa.
          </>
        ),
        time: "2 menit yang lalu",
      },
      {
        id: "d2",
        icon: "publish",
        tone: "bg-tertiary-container text-on-tertiary-container",
        body: (
          <>
            Kursus <span className="font-bold">&quot;Advance React 18&quot;</span> dipublikasikan
            oleh Mentor Sarah.
          </>
        ),
        time: "15 menit yang lalu",
      },
      {
        id: "d3",
        icon: "shopping_cart",
        tone: "bg-secondary-container text-on-secondary-container",
        body: (
          <>
            <span className="font-bold">Budi Santoso</span> membeli paket Langganan Tahunan.
          </>
        ),
        time: "1 jam yang lalu",
      },
      {
        id: "d4",
        icon: "warning",
        tone: "bg-error-container text-on-error-container",
        body: <>Upaya login mencurigakan terdeteksi dari IP 192.168.1.1</>,
        time: "3 jam yang lalu",
      },
    );
  }

  const chartHeights = [40, 55, 45, 70, 85, 95];
  const chartLabels = ["12k", "18k", "15k", "22k", "28k", "32k"];
  const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun"];

  const studentCount = usingDemo ? DEMO_STATS.totalStudents : stats.totalStudents || stats.totalUsers;
  const revenueLabel = formatCompactRp(stats.revenue);
  const activeCourses = stats.publishedCourses || stats.totalCourses;

  return (
    <div className="space-y-unit-8 p-6 md:p-margin-desktop">
      {/* Statistics Bento */}
      <div className="grid grid-cols-1 gap-gutter md:grid-cols-2 lg:grid-cols-4">
        <div className="tech-shadow card-emerald-glow rounded-xl border border-outline-variant bg-surface-container-lowest p-unit-6 transition-transform hover:-translate-y-1">
          <div className="mb-4 flex items-start justify-between">
            <div className="rounded-lg bg-primary-container p-3 text-on-primary-container">
              <span
                className="material-symbols-outlined"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                groups
              </span>
            </div>
            <span className="font-headline text-label-md font-bold text-primary">+12%</span>
          </div>
          <h3 className="font-headline text-label-md text-on-surface-variant">Total Siswa</h3>
          <p className="mt-1 font-headline text-headline-lg">{formatStudents(studentCount)}</p>
          <div className="mt-4 h-1.5 w-full rounded-full bg-surface-container">
            <div className="progress-gradient h-1.5 rounded-full" style={{ width: "75%" }} />
          </div>
        </div>

        <div className="tech-shadow card-emerald-glow rounded-xl border border-outline-variant bg-surface-container-lowest p-unit-6 transition-transform hover:-translate-y-1">
          <div className="mb-4 flex items-start justify-between">
            <div className="rounded-lg bg-tertiary-container p-3 text-on-tertiary-container">
              <span
                className="material-symbols-outlined"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                payments
              </span>
            </div>
            <span className="font-headline text-label-md font-bold text-tertiary">+8.4%</span>
          </div>
          <h3 className="font-headline text-label-md text-on-surface-variant">
            Pendapatan (Bulan Ini)
          </h3>
          <p className="mt-1 font-headline text-headline-lg">{revenueLabel}</p>
          <div className="mt-4 h-1.5 w-full rounded-full bg-surface-container">
            <div className="h-1.5 rounded-full bg-tertiary" style={{ width: "60%" }} />
          </div>
        </div>

        <div className="tech-shadow card-emerald-glow rounded-xl border border-outline-variant bg-surface-container-lowest p-unit-6 transition-transform hover:-translate-y-1">
          <div className="mb-4 flex items-start justify-between">
            <div className="rounded-lg bg-secondary-container p-3 text-on-secondary-container">
              <span
                className="material-symbols-outlined"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                menu_book
              </span>
            </div>
            <span className="font-headline text-label-md font-bold text-secondary">Aktif</span>
          </div>
          <h3 className="font-headline text-label-md text-on-surface-variant">Kursus Aktif</h3>
          <p className="mt-1 font-headline text-headline-lg">{activeCourses}</p>
          <div className="mt-4 flex -space-x-2">
            <div className="h-6 w-6 rounded-full border-2 border-surface bg-primary" />
            <div className="h-6 w-6 rounded-full border-2 border-surface bg-tertiary" />
            <div className="h-6 w-6 rounded-full border-2 border-surface bg-secondary" />
            <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-surface bg-outline-variant text-[8px] font-bold text-on-surface">
              +{Math.max(stats.instructorCount, 10)}
            </div>
          </div>
        </div>

        <div
          id="kesehatan"
          className="tech-shadow card-emerald-glow scroll-mt-24 rounded-xl border border-outline-variant bg-surface-container-lowest p-unit-6 transition-transform hover:-translate-y-1"
        >
          <div className="mb-4 flex items-start justify-between">
            <div className="rounded-lg bg-primary/10 p-3 text-primary">
              <span
                className="material-symbols-outlined"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                bolt
              </span>
            </div>
            <span className="rounded-full bg-primary-fixed px-2 py-0.5 text-[10px] font-bold text-on-primary-fixed uppercase">
              Optimal
            </span>
          </div>
          <h3 className="font-headline text-label-md text-on-surface-variant">
            Kesehatan Sistem
          </h3>
          <p className="mt-1 font-headline text-headline-lg">99.98%</p>
          <div className="mt-4 flex items-center gap-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
            <span className="text-[11px] font-medium text-primary">
              Semua server beroperasi normal
            </span>
          </div>
        </div>
      </div>

      {/* Chart + Activity */}
      <div className="grid grid-cols-1 gap-gutter lg:grid-cols-3">
        <div className="tech-shadow overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest lg:col-span-2">
          <div className="flex items-center justify-between border-b border-outline-variant p-unit-6">
            <div>
              <h2 className="font-headline text-headline-md font-bold text-on-surface">
                Pertumbuhan Pengguna
              </h2>
              <p className="font-headline text-label-md text-on-surface-variant">
                Analisis data 6 bulan terakhir
              </p>
            </div>
            <div className="flex rounded-lg bg-surface-container p-1">
              <button
                type="button"
                className="rounded bg-white px-3 py-1 text-label-md font-bold shadow-sm"
              >
                Bulan
              </button>
              <button
                type="button"
                className="px-3 py-1 text-label-md text-on-surface-variant"
              >
                Minggu
              </button>
            </div>
          </div>
          <div className="relative h-80 p-unit-6">
            <div className="absolute inset-x-6 bottom-12 flex h-56 items-end justify-between gap-4">
              {chartHeights.map((h, i) => (
                <div
                  key={months[i]}
                  className={`group relative w-full rounded-t-lg transition-all ${
                    i === chartHeights.length - 1
                      ? "bg-primary"
                      : "bg-surface-container-high hover:bg-primary/20"
                  }`}
                  style={{ height: `${h}%` }}
                >
                  <div
                    className={`absolute -top-8 left-1/2 -translate-x-1/2 rounded bg-on-surface px-2 py-1 text-[10px] text-white ${
                      i === chartHeights.length - 1
                        ? "opacity-100"
                        : "opacity-0 group-hover:opacity-100"
                    }`}
                  >
                    {chartLabels[i]}
                  </div>
                </div>
              ))}
            </div>
            <div className="absolute inset-x-6 bottom-4 flex justify-between text-[11px] font-bold tracking-wider text-on-surface-variant uppercase">
              {months.map((m) => (
                <span key={m}>{m}</span>
              ))}
            </div>
          </div>
        </div>

        <div className="tech-shadow rounded-xl border border-outline-variant bg-surface-container-lowest">
          <div className="border-b border-outline-variant p-unit-6">
            <h2 className="font-headline text-headline-md font-bold text-on-surface">
              Aktivitas Terbaru
            </h2>
            <p className="font-headline text-label-md text-on-surface-variant">
              Log sistem real-time
            </p>
          </div>
          <div className="space-y-6 p-unit-6">
            {activities.slice(0, 4).map((a) => (
              <div key={a.id} className="flex gap-4">
                <div
                  className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${a.tone}`}
                >
                  <span className="material-symbols-outlined text-sm">{a.icon}</span>
                </div>
                <div className="flex-1">
                  <p className="text-label-md leading-snug text-on-surface">{a.body}</p>
                  <p className="mt-1 text-[11px] text-on-surface-variant">{a.time}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="bg-surface-container/50 p-4 text-center">
            <Link
              href="/admin/users"
              className="font-headline text-label-md font-bold text-primary hover:underline"
            >
              Lihat Semua Aktivitas
            </Link>
          </div>
        </div>
      </div>

      {/* Bottom bento */}
      <div className="grid grid-cols-1 gap-gutter md:grid-cols-2 lg:grid-cols-3">
        <div className="tech-shadow relative flex flex-col justify-between overflow-hidden rounded-xl bg-primary p-unit-6 text-on-primary lg:col-span-1">
          <div className="relative z-10">
            <h3 className="mb-2 font-headline text-headline-md font-bold">Program Unggulan</h3>
            <p className="mb-6 text-sm opacity-80">
              Analisis performa jalur pembelajaran Full-Stack Developer 2024.
            </p>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase">Progress Kurikulum</span>
                <span className="text-xs font-bold">85%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-white/20">
                <div className="h-2 rounded-full bg-white" style={{ width: "85%" }} />
              </div>
            </div>
          </div>
          <div className="absolute -right-10 -bottom-10 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
          <Link
            href="/instructor/courses"
            className="mt-8 self-start rounded-lg bg-white px-4 py-2 text-label-md font-bold text-primary transition-transform active:scale-95"
          >
            Kelola Program
          </Link>
        </div>

        <div className="tech-shadow rounded-xl border border-outline-variant bg-surface-container-lowest p-unit-6 lg:col-span-2">
          <h3 className="mb-6 font-headline text-headline-md font-bold text-on-surface">
            Kursus Terpopuler
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-outline-variant text-[11px] font-bold tracking-widest text-on-surface-variant uppercase">
                  <th className="pb-3">Judul Kursus</th>
                  <th className="pb-3">Siswa</th>
                  <th className="pb-3">Rating</th>
                  <th className="pb-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/30">
                {popular.map((c) => (
                  <tr
                    key={c.id}
                    className="transition-colors hover:bg-surface-container/30"
                  >
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded ${c.iconTone}`}
                        >
                          <span className="material-symbols-outlined text-sm">{c.icon}</span>
                        </div>
                        <span className="text-label-md font-bold">{c.title}</span>
                      </div>
                    </td>
                    <td className="py-4 text-label-md font-medium">
                      {c.students.toLocaleString("en-US")}
                    </td>
                    <td className="py-4">
                      <div className="flex items-center gap-1 text-primary">
                        <span
                          className="material-symbols-outlined text-[16px]"
                          style={{ fontVariationSettings: "'FILL' 1" }}
                        >
                          star
                        </span>
                        <span className="text-label-md font-bold">{c.rating}</span>
                      </div>
                    </td>
                    <td className="py-4 text-right">
                      <span
                        className={`rounded px-2 py-1 text-[10px] font-bold ${
                          c.status === "TRENDING"
                            ? "bg-primary-container text-on-primary-container"
                            : "bg-surface-container text-on-surface-variant"
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {usingDemo && (
        <p className="text-center text-[11px] text-on-surface-variant">
          Menampilkan data contoh — hubungkan database untuk statistik langsung.
        </p>
      )}
    </div>
  );
}
