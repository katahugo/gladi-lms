/**
 * Job BullMQ — kirim email (D4).
 *
 * Mengirim email notifikasi via Resend untuk: sertifikat terbit, reset password,
 * konfirmasi pembelian. Dipanggil oleh worker via queue "lms".
 */

import { Resend } from "resend";

const API_KEY = process.env.RESEND_API_KEY;
const FROM = process.env.EMAIL_FROM ?? "Gladi LMS <no-reply@gladi.id>";

let resend: Resend | null = null;
if (API_KEY) {
  resend = new Resend(API_KEY);
}

export type EmailPayload = {
  to: string;
  subject: string;
  html: string;
};

export async function sendEmail(payload: EmailPayload): Promise<boolean> {
  if (!resend) {
    console.log("[email] RESEND_API_KEY belum diset — email tidak dikirim:", payload.subject);
    return false;
  }

  try {
    const { data, error } = await resend.emails.send({
      from: FROM,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
    });
    if (error) {
      console.error("[email] Gagal:", error);
      return false;
    }
    console.log("[email] Terkirim:", data?.id, payload.to);
    return true;
  } catch (err) {
    console.error("[email] Exception:", err instanceof Error ? err.message : err);
    return false;
  }
}
