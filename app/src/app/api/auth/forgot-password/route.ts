import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { users, verificationTokens } from "@/db/schema";
import { sendEmail } from "@/jobs/email";

/**
 * POST /api/auth/forgot-password
 *
 * Menerima email, menyimpan token pemulihan (jika akun ada), dan mengirim
 * instruksi via Resend bila dikonfigurasi. Respons selalu generik agar tidak
 * membocorkan apakah email terdaftar.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body bukan JSON valid" }, { status: 400 });
  }

  const email =
    typeof (body as { email?: unknown })?.email === "string"
      ? (body as { email: string }).email.trim().toLowerCase()
      : "";

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "Format email tidak valid" }, { status: 400 });
  }

  try {
    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
      columns: { id: true, email: true, name: true, passwordHash: true },
    });

    // Hanya kirim untuk akun credentials (punya passwordHash).
    if (user?.passwordHash) {
      const token = randomBytes(32).toString("hex");
      const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 jam

      await db
        .delete(verificationTokens)
        .where(eq(verificationTokens.identifier, email));

      await db.insert(verificationTokens).values({
        identifier: email,
        token,
        expires,
      });

      const appUrl = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
      const resetUrl = `${appUrl}/reset-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;

      await sendEmail({
        to: email,
        subject: "Pemulihan Kata Sandi — Gladi.ID",
        html: `
          <p>Halo${user.name ? ` ${user.name}` : ""},</p>
          <p>Kami menerima permintaan untuk mengatur ulang kata sandi akun Gladi.ID Anda.</p>
          <p><a href="${resetUrl}">Klik di sini untuk mengatur ulang kata sandi</a></p>
          <p>Tautan berlaku selama 1 jam. Jika Anda tidak meminta ini, abaikan email ini.</p>
          <p>— Tim Gladi.ID</p>
        `,
      });
    }
  } catch (err) {
    console.error(
      "[forgot-password]",
      err instanceof Error ? err.message : err,
    );
    // Tetap respons generik — jangan bocorkan kegagalan internal ke klien.
  }

  return NextResponse.json({
    ok: true,
    message:
      "Jika email terdaftar, instruksi pemulihan telah dikirim. Periksa kotak masuk Anda.",
  });
}
