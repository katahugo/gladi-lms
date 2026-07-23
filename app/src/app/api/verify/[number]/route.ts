import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { certificates, courses, users } from "@/db/schema";

/**
 * GET /api/verify/[number] — verifikasi publik nomor sertifikat.
 *
 * Endpoint PUBLIK (tidak butuh login). Mengembalikan info sertifikat yang
 * TIDAK sensitif (nama peserta, judul kursus, nama instruktur, tanggal terbit).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ number: string }> },
) {
  const { number } = await params;
  const normalized = number.trim().toUpperCase();

  const cert = await db.query.certificates.findFirst({
    where: eq(certificates.certificateNumber, normalized),
  });
  if (!cert) {
    return NextResponse.json({ valid: false, error: "Nomor sertifikat tidak ditemukan" }, { status: 404 });
  }

  const [holder, course] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, cert.userId) }),
    db.query.courses.findFirst({ where: eq(courses.id, cert.courseId) }),
  ]);
  const instructor = course?.instructorId
    ? await db.query.users.findFirst({ where: eq(users.id, course.instructorId) })
    : null;

  return NextResponse.json({
    valid: true,
    certificateNumber: cert.certificateNumber,
    issuedAt: cert.issuedAt,
    holderName: holder?.name ?? "-",
    courseTitle: course?.title ?? "-",
    instructorName: instructor?.name ?? "-",
  });
}
