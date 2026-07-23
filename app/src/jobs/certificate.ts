/**
 * Job BullMQ — generate sertifikat PDF (D4).
 *
 * Membuat file PDF sederhana (tanpa library eksternal — cukup teks terformat
 * untuk MVP) dan upload ke MinIO. Dipanggil worker setelah sertifikat terbit.
 * Dikirim juga via email bila RESEND_API_KEY tersedia.
 */
import { ensureBucket, presignUpload, buildKey } from "@/lib/storage";
import { sendEmail } from "./email";

interface CertificateData {
  certificateNumber: string;
  holderName: string;
  courseTitle: string;
  instructorName: string;
  issuedDate: string;
  userEmail: string;
}

/**
 * Generate HTML sederhana untuk sertifikat PDF.
 * Untuk MVP, cukup render HTML yang bisa dicetak browser (future: gunakan
 * puppeteer/playwright untuk PDF asli bila dibutuhkan).
 */
function renderHtml(data: CertificateData): string {
  return `<!DOCTYPE html>
<html lang="id">
<head><meta charset="utf-8"><title>Sertifikat ${data.certificateNumber}</title>
<style>
  body { font-family: system-ui, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #fff; }
  .cert { max-width: 800px; padding: 60px; border: 4px solid #059669; border-radius: 16px; text-align: center; }
  .cert h1 { font-size: 32px; color: #059669; margin-bottom: 8px; }
  .cert .name { font-size: 28px; font-weight: bold; color: #111; margin: 24px 0 8px; }
  .cert .course { font-size: 20px; color: #444; margin-bottom: 24px; }
  .cert .meta { font-size: 14px; color: #666; margin-top: 32px; line-height: 1.8; }
  .cert .number { font-family: monospace; font-size: 12px; color: #059669; margin-top: 16px; }
  .cert .verify { font-size: 11px; color: #999; margin-top: 32px; }
</style></head>
<body>
  <div class="cert">
    <h1>Gladi LMS</h1>
    <p style="font-size:16px;color:#666;">Menerangkan bahwa</p>
    <p class="name">${data.holderName}</p>
    <p style="font-size:16px;color:#444;">telah menyelesaikan kursus</p>
    <p class="course">${data.courseTitle}</p>
    <p style="font-size:14px;color:#555;">Instruktur: ${data.instructorName}</p>
    <div class="meta">
      <p>Diterbitkan: ${data.issuedDate}</p>
    </div>
    <p class="number">${data.certificateNumber}</p>
    <p class="verify">Verifikasi keaslian: https://gladi.id/verify/${data.certificateNumber}</p>
  </div>
</body>
</html>`;
}

export async function generateCertificatePdf(data: CertificateData): Promise<void> {
  try {
    await ensureBucket();

    const html = renderHtml(data);
    const key = buildKey("certificate", data.certificateNumber, "certificate.html");

    // Upload HTML ke MinIO (bisa dibuka di browser langsung sebagai halaman sertifikat)
    const uploadUrl = await presignUpload(key, "text/html");
    await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "text/html" },
      body: html,
    });

    // Kirim email notifikasi
    await sendEmail({
      to: data.userEmail,
      subject: `Sertifikat Anda: ${data.courseTitle} (${data.certificateNumber})`,
      html: `<p>Selamat, <strong>${data.holderName}</strong>!</p>
<p>Anda telah menyelesaikan kursus <strong>${data.courseTitle}</strong>.</p>
<p>Nomor sertifikat: <strong>${data.certificateNumber}</strong></p>
<p>Verifikasi publik: <a href="https://gladi.id/verify/${data.certificateNumber}">gladi.id/verify/${data.certificateNumber}</a></p>`,
    });

    console.log(`[certificate] Sertifikat ${data.certificateNumber} terbit untuk ${data.userEmail}`);
  } catch (err) {
    console.error("[certificate] Gagal generate:", err instanceof Error ? err.message : err);
  }
}
