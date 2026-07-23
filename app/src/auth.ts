import NextAuth from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

import { db } from "@/db";
import { users, accounts, sessions, verificationTokens } from "@/db/schema";

/**
 * Konfigurasi Auth.js (NextAuth v5) — sesuai PRD §6.1/§6.2.
 *
 * - Adapter Drizzle: session & akun OAuth disimpan di PostgreSQL (tabel Auth.js
 *   sudah dibuat di A5).
 * - Credentials: email + password (bcrypt), cocok untuk registrasi lokal.
 * - Google OAuth: provider bawaan, dikonfigurasi via AUTH_GOOGLE_ID/SECRET.
 * - RBAC: kolom `role` di tabel users dibawa ke JWT & session, dicek di middleware.
 *
 * Strategi session: "jwt" — wajib untuk credentials provider (adapter database
 * tidak bisa menyimpan session credentials di tabel sessions). Role & user id
 * tetap diverifikasi dari database saat login; untuk proteksi route yang butuh
 * data role terkini, middleware membaca dari token JWT yang sudah berisi role.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),

  session: { strategy: "jwt" },

  // Wajib di balik reverse proxy (Nginx → container): percayai host dari header
  // X-Forwarded-Host yang diteruskan Nginx. Tanpa ini Auth.js v5 menolak semua
  // request dengan error UntrustedHost (500 "problem with server configuration")
  // karena host internal container (0.0.0.0:3000) / domain tidak dikenali.
  trustHost: true,

  pages: {
    signIn: "/login",
  },

  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      allowDangerousEmailAccountLinking: false,
    }),

    Credentials({
      name: "Email & Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email;
        const password = credentials?.password;
        if (typeof email !== "string" || typeof password !== "string") {
          return null;
        }

        const user = await db.query.users.findFirst({
          where: eq(users.email, email.toLowerCase()),
        });
        if (!user?.passwordHash) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          role: user.role,
        };
      },
    }),
  ],

  callbacks: {
    // Simpan role & user id ke token JWT saat login
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        // role datang dari authorize() (credentials) atau default student (OAuth baru)
        token.role = ((user as { role?: string }).role ?? "student") as
          | "student" | "instructor" | "admin" | "support";
      }
      return token;
    },

    // Bawa role & user id ke session agar bisa dibaca di server component/middleware
    async session({ session, token }) {
      if (token.sub && session.user) {
        session.user.id = token.sub;
        session.user.role = (token.role as "student" | "instructor" | "admin" | "support") ?? "student";
      }
      return session;
    },
  },
});
