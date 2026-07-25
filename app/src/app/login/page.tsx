import type { Metadata } from "next";
import Link from "next/link";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { signIn } from "@/auth";
import { PasswordField } from "@/components/password-field";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Masuk",
  description: "Masuk ke dashboard belajar Gladi.ID untuk melanjutkan progres.",
};

const WA_NUMBER = process.env.NEXT_PUBLIC_WA_NUMBER ?? "6281234567890";
const WA_HREF = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent("Halo, saya butuh bantuan masuk ke Gladi.ID")}`;

async function LoginError({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  if (!error) return null;
  return (
    <p className="mb-unit-4 rounded-lg border border-error/30 bg-error-container/40 px-unit-3 py-unit-2 font-headline text-label-md text-on-error-container">
      Email atau kata sandi salah. Silakan coba lagi.
    </p>
  );
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  async function loginCredentials(formData: FormData) {
    "use server";
    const params = await searchParams;
    try {
      await signIn("credentials", {
        email: formData.get("email"),
        password: formData.get("password"),
        redirectTo: params.callbackUrl ?? "/dashboard",
      });
    } catch (error) {
      if (error instanceof AuthError) {
        const url = new URL("/login", process.env.APP_URL ?? "http://localhost:3000");
        url.searchParams.set("error", "credentials");
        if (params.callbackUrl) url.searchParams.set("callbackUrl", params.callbackUrl);
        redirect(url.toString());
      }
      throw error;
    }
  }

  async function loginGoogle() {
    "use server";
    const params = await searchParams;
    await signIn("google", { redirectTo: params.callbackUrl ?? "/dashboard" });
  }

  const year = new Date().getFullYear();

  return (
    <div className="flex min-h-screen flex-col bg-background font-body text-on-background">
      <main className="flex flex-grow items-center justify-center p-margin-mobile md:p-margin-desktop">
        <div className="w-full max-w-md space-y-unit-8 rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-unit-8 shadow-sm md:p-unit-12">
          <div className="mb-unit-4 flex flex-col items-center gap-unit-3 text-center">
            <div className="inline-flex items-center justify-center rounded-xl bg-primary-container p-unit-3 text-on-primary-container">
              <span
                className="material-symbols-outlined text-[32px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                terminal
              </span>
            </div>
            <div className="space-y-unit-2">
              <h1 className="font-headline text-headline-lg text-on-surface">
                Selamat Datang Kembali
              </h1>
              <p className="mx-auto max-w-[300px] font-body text-body-md text-on-surface-variant">
                Masuk ke dashboard belajar Anda untuk melanjutkan progres.
              </p>
            </div>
          </div>

          <Suspense>
            <LoginError searchParams={searchParams} />
          </Suspense>

          <form action={loginCredentials} className="space-y-unit-6">
            <div className="space-y-unit-2">
              <label
                htmlFor="email"
                className="font-headline text-label-md text-on-surface-variant"
              >
                Alamat Email
              </label>
              <div className="group relative">
                <span className="material-symbols-outlined pointer-events-none absolute top-1/2 left-unit-3 -translate-y-1/2 text-[20px] text-outline transition-colors group-focus-within:text-primary-container">
                  mail
                </span>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="nama@perusahaan.com"
                  className="font-body text-body-md w-full rounded-lg border border-outline-variant/30 bg-surface-container-low py-unit-3 pr-unit-4 pl-11 transition-all placeholder:text-outline/50 focus:border-primary-container focus:ring-2 focus:ring-primary-container focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-unit-2">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="font-headline text-label-md text-on-surface-variant"
                >
                  Kata Sandi
                </label>
                <Link
                  href="/forgot-password"
                  className="font-headline text-label-md text-primary transition-all hover:underline"
                >
                  Lupa Kata Sandi?
                </Link>
              </div>
              <PasswordField />
            </div>

            <div className="flex items-center gap-unit-2">
              <input
                id="remember"
                name="remember"
                type="checkbox"
                className="h-4 w-4 rounded border-outline-variant text-primary focus:ring-primary-container"
              />
              <label
                htmlFor="remember"
                className="cursor-pointer font-headline text-label-md text-on-surface-variant"
              >
                Ingat saya
              </label>
            </div>

            <button
              type="submit"
              className="flex w-full items-center justify-center gap-unit-2 rounded-lg bg-primary-container py-unit-4 font-headline text-body-md text-on-primary-container shadow-sm transition-all hover:bg-primary hover:text-on-primary hover:shadow-md active:scale-[0.98]"
            >
              <span className="font-bold">Masuk ke Dashboard</span>
              <span className="material-symbols-outlined">arrow_forward</span>
            </button>
          </form>

          <div className="relative py-unit-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-outline-variant/20" />
            </div>
            <div className="relative flex justify-center text-label-md">
              <span className="bg-surface-container-lowest px-unit-3 text-[11px] tracking-wider text-on-surface-variant uppercase">
                Atau
              </span>
            </div>
          </div>

          <form action={loginGoogle}>
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-unit-3 rounded-lg border border-outline-variant/30 bg-white py-unit-4 font-headline text-body-md text-on-surface transition-all hover:bg-surface-container-low active:scale-[0.98]"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              <span>Masuk dengan Google</span>
            </button>
          </form>

          <div className="pt-unit-4 text-center">
            <p className="font-body text-body-md text-on-surface-variant">
              Belum punya akun?{" "}
              <Link
                href="/register"
                className="font-bold text-primary hover:underline"
              >
                Mulai belajar gratis
              </Link>
            </p>
          </div>
        </div>
      </main>

      <footer className="flex flex-col items-center justify-between gap-unit-4 border-t border-outline-variant/20 bg-surface-container-lowest px-margin-mobile py-unit-6 md:flex-row md:px-margin-desktop">
        <div className="font-headline text-label-md text-on-surface-variant opacity-70">
          © {year} Gladi.ID. Memberdayakan generasi profesional IT berikutnya.
        </div>
        <div className="flex gap-unit-6 font-headline text-label-md text-secondary">
          <a href={WA_HREF} className="transition-colors hover:text-primary">
            Pusat Bantuan
          </a>
          <span className="cursor-default opacity-60">Kebijakan Privasi</span>
          <span className="cursor-default opacity-60">Ketentuan Layanan</span>
        </div>
      </footer>
    </div>
  );
}
