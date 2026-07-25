import type { Metadata } from "next";
import Link from "next/link";

import { ResetPasswordForm } from "@/components/reset-password-form";

export const metadata: Metadata = {
  title: "Atur Ulang Kata Sandi",
  description: "Buat kata sandi baru untuk akun Gladi.ID Anda.",
};

/**
 * Halaman atur ulang kata sandi — dibuka dari tautan email pemulihan.
 */
export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface px-margin-mobile py-unit-12 font-body text-on-surface md:px-margin-desktop">
      <div className="bg-tech-gradient pointer-events-none fixed inset-0 opacity-40" />
      <div className="relative z-10 w-full max-w-[440px] rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-unit-8 shadow-sm md:p-unit-12">
        <div className="mb-unit-8 flex flex-col items-center gap-unit-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary-container">
            <span
              className="material-symbols-outlined text-[32px] text-on-primary-container"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              lock_reset
            </span>
          </div>
          <h1 className="font-headline text-headline-md text-on-background">
            Atur Ulang Kata Sandi
          </h1>
          <p className="font-body text-body-md text-on-secondary-container">
            Masukkan kata sandi baru untuk akun Anda.
          </p>
        </div>
        <ResetPasswordForm />
        <div className="mt-unit-8 text-center">
          <Link
            href="/login"
            className="inline-flex items-center gap-unit-2 font-headline text-label-md text-primary hover:underline"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Kembali ke Halaman Masuk
          </Link>
        </div>
      </div>
    </div>
  );
}
