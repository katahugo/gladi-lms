import { eq, and, gt } from "drizzle-orm";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { db } from "@/db";
import { users, verificationTokens } from "@/db/schema";

/**
 * POST /api/auth/reset-password
 *
 * Body: { email, token, password } — verifikasi token lalu update passwordHash.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body bukan JSON valid" }, { status: 400 });
  }

  const { email, token, password } = (body ?? {}) as Record<string, unknown>;

  if (
    typeof email !== "string" ||
    !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ||
    typeof token !== "string" ||
    token.length < 16 ||
    typeof password !== "string" ||
    password.length < 8
  ) {
    return NextResponse.json(
      { error: "Email, token, dan password (min 8) wajib diisi" },
      { status: 400 },
    );
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    const [row] = await db
      .select()
      .from(verificationTokens)
      .where(
        and(
          eq(verificationTokens.identifier, normalizedEmail),
          eq(verificationTokens.token, token),
          gt(verificationTokens.expires, new Date()),
        ),
      )
      .limit(1);

    if (!row) {
      return NextResponse.json(
        { error: "Tautan pemulihan tidak valid atau sudah kedaluwarsa" },
        { status: 400 },
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await db
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.email, normalizedEmail));

    await db
      .delete(verificationTokens)
      .where(eq(verificationTokens.identifier, normalizedEmail));

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[reset-password]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Gagal mengatur ulang kata sandi" }, { status: 500 });
  }
}
