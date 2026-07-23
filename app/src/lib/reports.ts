import { and, count, eq, inArray, sql, sum } from "drizzle-orm";

import { db } from "@/db";
import {
  certificates,
  courses,
  enrollments,
  transactions,
  users,
} from "@/db/schema";

/**
 * Helper query untuk laporan dashboard (E3).
 * Semua query difilter berdasarkan konteks (admin lihat global, instruktur
 * lihat hanya kursus miliknya).
 */

export interface DashboardStats {
  totalCourses: number;
  publishedCourses: number;
  totalEnrollments: number;
  totalStudents: number;
  totalCertificates: number;
  revenue: number; // total transaksi paid (Rupiah)
  transactionCount: number; // jumlah transaksi paid
}

export async function getInstructorStats(instructorId: string): Promise<DashboardStats> {
  // Kursus milik instruktur
  const myCourses = await db
    .select({ id: courses.id, status: courses.status })
    .from(courses)
    .where(eq(courses.instructorId, instructorId));

  const courseIds = myCourses.map((c) => c.id);
  const publishedCount = myCourses.filter((c) => c.status === "published").length;

  if (courseIds.length === 0) {
    return {
      totalCourses: 0,
      publishedCourses: 0,
      totalEnrollments: 0,
      totalStudents: 0,
      totalCertificates: 0,
      revenue: 0,
      transactionCount: 0,
    };
  }

  const [enrRow] = await db
    .select({
      total: count(enrollments.id),
      distinctStudents: sql<number>`count(distinct ${enrollments.userId})`,
    })
    .from(enrollments)
    .where(inArray(enrollments.courseId, courseIds));

  const [certRow] = await db
    .select({ total: count(certificates.id) })
    .from(certificates)
    .where(inArray(certificates.courseId, courseIds));

  const [txRow] = await db
    .select({ revenue: sum(transactions.amount), tx: count(transactions.id) })
    .from(transactions)
    .where(and(inArray(transactions.courseId, courseIds), eq(transactions.status, "paid")));

  return {
    totalCourses: courseIds.length,
    publishedCourses: publishedCount,
    totalEnrollments: Number(enrRow?.total ?? 0),
    totalStudents: Number(enrRow?.distinctStudents ?? 0),
    totalCertificates: Number(certRow?.total ?? 0),
    revenue: Number(txRow?.revenue ?? 0),
    transactionCount: Number(txRow?.tx ?? 0),
  };
}

export async function getAdminStats(): Promise<DashboardStats & {
  totalUsers: number;
  instructorCount: number;
  pendingTransactions: number;
}> {
  const [courseAll] = await db.select({ total: count(courses.id) }).from(courses);
  const [coursePub] = await db
    .select({ total: count(courses.id) })
    .from(courses)
    .where(eq(courses.status, "published"));

  const [enrAll] = await db.select({ total: count(enrollments.id) }).from(enrollments);
  const [studentDistinct] = await db
    .select({ total: sql<number>`count(distinct ${enrollments.userId})` })
    .from(enrollments);

  const [certAll] = await db.select({ total: count(certificates.id) }).from(certificates);
  const [txPaid] = await db
    .select({ revenue: sum(transactions.amount), tx: count(transactions.id) })
    .from(transactions)
    .where(eq(transactions.status, "paid"));
  const [txPending] = await db
    .select({ total: count(transactions.id) })
    .from(transactions)
    .where(eq(transactions.status, "pending"));

  const [usersAll] = await db.select({ total: count(users.id) }).from(users);
  const [instructors] = await db
    .select({ total: count(users.id) })
    .from(users)
    .where(eq(users.role, "instructor"));

  return {
    totalCourses: Number(courseAll?.total ?? 0),
    publishedCourses: Number(coursePub?.total ?? 0),
    totalEnrollments: Number(enrAll?.total ?? 0),
    totalStudents: Number(studentDistinct?.total ?? 0),
    totalCertificates: Number(certAll?.total ?? 0),
    revenue: Number(txPaid?.revenue ?? 0),
    transactionCount: Number(txPaid?.tx ?? 0),
    totalUsers: Number(usersAll?.total ?? 0),
    instructorCount: Number(instructors?.total ?? 0),
    pendingTransactions: Number(txPending?.total ?? 0),
  };
}
