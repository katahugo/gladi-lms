import type { Metadata } from "next";
import Link from "next/link";

import { signIn } from "@/auth";
import { RegisterForm } from "@/components/register-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Daftar",
  description:
    "Buat akun Gladi.ID dan mulai kuasai teknologi modern bersama 50.000+ developer.",
};

const FEATURES = [
  {
    icon: "verified",
    tone: "text-primary bg-primary-container/20",
    title: "Sertifikasi Industri",
    desc: "Diakui secara global oleh partner teknologi.",
  },
  {
    icon: "groups",
    tone: "text-tertiary bg-tertiary-container/20",
    title: "Mentoring 1-on-1",
    desc: "Bimbingan langsung dari ahli di bidangnya.",
  },
];

export default function RegisterPage() {
  async function loginAfterRegister(email: string, password: string) {
    "use server";
    await signIn("credentials", { email, password, redirectTo: "/dashboard" });
  }

  async function registerGoogle() {
    "use server";
    await signIn("google", { redirectTo: "/dashboard" });
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background p-unit-4 font-body text-on-background md:p-unit-12">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-[5%] -left-[5%] h-[45%] w-[45%] rounded-full bg-primary-container opacity-5 blur-[120px]" />
        <div className="absolute right-0 bottom-0 h-[35%] w-[35%] rounded-full bg-tertiary opacity-5 blur-[100px]" />
      </div>

      <main className="grid w-full max-w-6xl grid-cols-1 items-center gap-unit-12 lg:grid-cols-2">
        <div className="hidden space-y-unit-8 lg:block">
          <div className="space-y-unit-4">
            <div className="mb-unit-4 inline-flex items-center gap-unit-2">
              <div className="primary-gradient flex h-10 w-10 items-center justify-center rounded-xl shadow-lg">
                <span
                  className="material-symbols-outlined text-2xl text-white"
                  style={{ fontVariationSettings: "'wght' 700" }}
                >
                  shield
                </span>
              </div>
              <span className="font-headline text-headline-md font-extrabold tracking-tight text-primary">
                Gladi.ID
              </span>
            </div>
            <h1 className="font-headline text-headline-xl leading-tight text-on-surface">
              Kuasai <span className="text-primary">Teknologi</span> Modern
            </h1>
            <p className="max-w-md font-body text-body-lg text-on-surface-variant">
              Bergabunglah dengan 50.000+ developer membangun masa depan.
            </p>
          </div>

          <div className="space-y-unit-4">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="flex items-center gap-unit-4 rounded-xl border border-outline-variant/30 bg-surface-container-low p-unit-4"
              >
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-lg ${f.tone}`}
                >
                  <span className="material-symbols-outlined text-2xl">{f.icon}</span>
                </div>
                <div>
                  <p className="font-headline text-label-md font-bold text-on-surface">
                    {f.title}
                  </p>
                  <p className="text-sm text-on-surface-variant">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-center lg:justify-end">
          <div className="w-full max-w-md rounded-2xl border border-outline-variant/50 bg-surface-container-lowest p-unit-8 shadow-2xl md:p-unit-10">
            <div className="mb-unit-8">
              <h2 className="font-headline text-headline-md text-on-surface">
                Daftar Akun Baru
              </h2>
              <p className="mt-unit-1 font-body text-body-md text-on-surface-variant">
                Mulai perjalanan belajar Anda hari ini.
              </p>
            </div>

            <RegisterForm onRegistered={loginAfterRegister} />

            <div className="relative my-unit-6 flex items-center">
              <div className="flex-grow border-t border-outline-variant" />
              <span className="px-4 text-sm text-outline">atau</span>
              <div className="flex-grow border-t border-outline-variant" />
            </div>

            <form action={registerGoogle}>
              <button
                type="submit"
                className="flex w-full items-center justify-center gap-3 rounded-lg border border-outline-variant px-4 py-unit-3 font-medium text-on-surface transition-colors hover:bg-surface-container-low"
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
                Daftar dengan Google
              </button>
            </form>

            <p className="pt-unit-6 text-center text-sm text-on-surface-variant">
              Sudah punya akun?{" "}
              <Link href="/login" className="font-bold text-primary hover:underline">
                Masuk
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
