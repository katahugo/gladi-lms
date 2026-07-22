import { auth } from "@/auth";
import { NextResponse } from "next/server";

/**
 * Middleware RBAC (PRD §6.2 langkah 5).
 *
 * Aturan akses berbasis prefix route:
 *   /admin/*       → hanya role admin
 *   /instructor/*  → instructor atau admin
 *   /dashboard/*   → semua user yang sudah login
 *   /support/*     → support atau admin
 *
 * User belum login → redirect ke /login.
 * Login tapi role tidak cukup → redirect ke / (bukan 403, agar UX konsisten).
 */
export default auth((req) => {
  const { nextUrl } = req;
  const session = req.auth;

  const isLoggedIn = !!session?.user;
  const role = session?.user?.role;

  const path = nextUrl.pathname;

  const rules: Array<{ prefix: string; allowed: string[] }> = [
    { prefix: "/admin", allowed: ["admin"] },
    { prefix: "/instructor", allowed: ["instructor", "admin"] },
    { prefix: "/support", allowed: ["support", "admin"] },
    { prefix: "/dashboard", allowed: ["student", "instructor", "admin", "support"] },
  ];

  const rule = rules.find((r) => path.startsWith(r.prefix));
  if (!rule) return NextResponse.next();

  if (!isLoggedIn) {
    const loginUrl = new URL("/login", nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", path);
    return NextResponse.redirect(loginUrl);
  }

  if (role && !rule.allowed.includes(role)) {
    return NextResponse.redirect(new URL("/", nextUrl.origin));
  }

  return NextResponse.next();
});

// Hanya jalankan middleware pada route yang diproteksi (hemat resource)
export const config = {
  matcher: ["/admin/:path*", "/instructor/:path*", "/support/:path*", "/dashboard/:path*"],
};
