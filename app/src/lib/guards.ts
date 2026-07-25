import { NextResponse } from "next/server";
import { redirect } from "next/navigation";

import { auth } from "@/auth";

type Role = "student" | "instructor" | "admin" | "support";
type AppUser = {
  id: string;
  role: Role;
  email?: string | null;
  name?: string | null;
};

/**
 * Guard sisi server untuk PAGE / Server Action: redirect bila tidak berhak.
 * JANGAN dipakai di Route Handler API — redirect menghasilkan HTML, bukan JSON.
 */
export async function requireRole(allowed: Role[]) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!allowed.includes(session.user.role)) redirect("/");
  return session.user;
}

/** Khusus instruktur/admin (pemilik konten) — untuk PAGE. */
export async function requireInstructor() {
  return requireRole(["instructor", "admin"]);
}

type ApiAuthOk = { ok: true; user: AppUser };
type ApiAuthErr = { ok: false; response: NextResponse };

/**
 * Guard untuk Route Handler API — selalu mengembalikan JSON 401/403,
 * tidak pernah redirect HTML (penyebab error "Unexpected token '<'").
 */
export async function requireApiRole(allowed: Role[]): Promise<ApiAuthOk | ApiAuthErr> {
  const session = await auth();
  if (!session?.user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Anda harus login" }, { status: 401 }),
    };
  }
  if (!allowed.includes(session.user.role)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Akses ditolak" }, { status: 403 }),
    };
  }
  return { ok: true, user: session.user as AppUser };
}

export async function requireApiInstructor() {
  return requireApiRole(["instructor", "admin"]);
}

export async function requireApiAdmin() {
  return requireApiRole(["admin"]);
}
