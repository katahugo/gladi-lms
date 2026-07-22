import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

import { db } from "@/db";
import { users } from "@/db/schema";

/**
 * POST /api/register — registrasi akun siswa baru (email + password).
 * Password di-hash bcrypt (cost 12) sebelum disimpan — PRD §6.2 langkah 2.
 * Role default: student. Role lain diangkat oleh admin, bukan lewat endpoint ini.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body bukan JSON valid" }, { status: 400 });
  }

  const { name, email, password } = (body ?? {}) as Record<string, unknown>;

  if (
    typeof name !== "string" || name.trim().length < 2 ||
    typeof email !== "string" || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ||
    typeof password !== "string" || password.length < 8
  ) {
    return NextResponse.json(
      { error: "Nama (min 2), email valid, dan password (min 8) wajib diisi" },
      { status: 400 },
    );
  }

  const normalizedEmail = email.toLowerCase().trim();

  const existing = await db.query.users.findFirst({
    where: eq(users.email, normalizedEmail),
  });
  if (existing) {
    // Pesan generik agar tidak membocorkan email mana yang terdaftar
    return NextResponse.json({ error: "Registrasi gagal diproses" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const [created] = await db
    .insert(users)
    .values({ name: name.trim(), email: normalizedEmail, passwordHash })
    .returning({ id: users.id, email: users.email });

  return NextResponse.json(
    { id: created.id, email: created.email },
    { status: 201 },
  );
}
