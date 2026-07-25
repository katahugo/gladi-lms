import type { Metadata } from "next";
import Link from "next/link";

import { ForgotPasswordForm } from "@/components/forgot-password-form";

export const metadata: Metadata = {
  title: "Lupa Kata Sandi",
  description:
    "Atur ulang kata sandi akun Gladi.ID. Masukkan email terdaftar untuk menerima instruksi pemulihan.",
};

const WA_NUMBER = process.env.NEXT_PUBLIC_WA_NUMBER ?? "6281234567890";
const WA_HREF = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent("Halo, saya butuh bantuan reset kata sandi Gladi.ID")}`;

/**
 * Halaman lupa kata sandi — minta email, kirim instruksi pemulihan.
 */
export default function ForgotPasswordPage() {
  const year = new Date().getFullYear();

  return (
    <div className="selection:bg-primary-container selection:text-on-primary-container flex min-h-screen flex-col items-center justify-between bg-surface font-body text-on-surface">
      <div className="bg-tech-gradient pointer-events-none fixed inset-0 z-0 overflow-hidden opacity-40" />

      <main className="relative z-10 flex w-full flex-1 items-center justify-center px-margin-mobile py-unit-12 md:px-margin-desktop">
        <div className="flex w-full max-w-[440px] flex-col items-center rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-unit-8 shadow-sm transition-all duration-300 hover:shadow-lg md:p-unit-12">
          <div className="mb-unit-8 flex flex-col items-center gap-unit-4">
            <div className="mb-unit-2 flex h-16 w-16 items-center justify-center rounded-xl bg-primary-container">
              <span
                className="material-symbols-outlined text-[40px] text-on-primary-container"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                security
              </span>
            </div>
            <h1 className="font-headline text-headline-md tracking-tight text-primary">
              Gladi.ID
            </h1>
          </div>

          <div className="mb-unit-8 w-full space-y-unit-3 text-center">
            <h2 className="font-headline text-headline-lg-mobile text-on-background md:text-headline-lg">
              Lupa Kata Sandi?
            </h2>
            <p className="mx-auto max-w-[340px] font-body text-body-md leading-relaxed text-on-secondary-container">
              Masukkan alamat email yang terdaftar dan kami akan mengirimkan
              instruksi untuk mengatur ulang kata sandi Anda.
            </p>
          </div>

          <ForgotPasswordForm />

          <div className="mt-unit-8">
            <Link
              href="/login"
              className="group inline-flex items-center gap-unit-2 font-headline text-label-md text-primary transition-all hover:underline hover:decoration-2 hover:underline-offset-4 active:opacity-70"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              Kembali ke Halaman Masuk
            </Link>
          </div>
        </div>
      </main>

      <footer className="relative z-10 w-full border-t border-outline-variant/30 bg-surface-container-low px-margin-mobile py-unit-8 md:px-margin-desktop">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-unit-4 md:flex-row">
          <p className="font-headline text-label-md text-on-secondary-container">
            © {year} Gladi.ID. Semua Hak Dilindungi.
          </p>
          <div className="flex gap-unit-6">
            <a
              href={WA_HREF}
              className="font-headline text-label-md text-on-secondary-container transition-colors hover:text-primary"
            >
              Bantuan
            </a>
            <span className="cursor-default font-headline text-label-md text-on-secondary-container/60">
              Kebijakan Privasi
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
