import { auth } from "@/auth";
import { redirect } from "next/navigation";

/**
 * Guard sisi server: pastikan user login dan punya salah satu role yang
 * diizinkan. Dipakai oleh server actions & halaman terproteksi.
 * Middleware (RBAC) sudah memfilter di level route; ini lapisan kedua
 * untuk defense-in-depth di level aksi data.
 */
export async function requireRole(allowed: Array<"student" | "instructor" | "admin" | "support">) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!allowed.includes(session.user.role)) redirect("/");
  return session.user;
}

/** Khusus instruktur/admin (pemilik konten). */
export async function requireInstructor() {
  return requireRole(["instructor", "admin"]);
}
