import type { DefaultSession } from "next-auth";

/**
 * Perluasan tipe Auth.js: tambahkan `id` dan `role` ke session.user.
 * Role mengikuti enum user_role di database (PRD §2).
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "student" | "instructor" | "admin" | "support";
    } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    role?: "student" | "instructor" | "admin" | "support";
  }
}
