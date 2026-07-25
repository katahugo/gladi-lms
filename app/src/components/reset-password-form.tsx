"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";

function ResetPasswordInner() {
  const router = useRouter();
  const params = useSearchParams();
  const email = params.get("email") ?? "";
  const token = params.get("token") ?? "";

  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const invalidLink = !email || !token;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const password = String(new FormData(e.currentTarget).get("password") ?? "");
    if (password.length < 8) {
      setError("Kata sandi minimal 8 karakter.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token, password }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Gagal mengatur ulang kata sandi.");
      setDone(true);
      setTimeout(() => router.push("/login"), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan.");
      setBusy(false);
    }
  }

  if (invalidLink) {
    return (
      <div className="space-y-unit-4 text-center">
        <p className="text-on-secondary-container">
          Tautan pemulihan tidak lengkap. Minta instruksi baru dari halaman lupa kata sandi.
        </p>
        <Link href="/forgot-password" className="font-bold text-primary hover:underline">
          Kembali ke Lupa Kata Sandi
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="w-full space-y-unit-6">
      {error && (
        <p className="rounded-lg border border-error/30 bg-error-container/40 px-unit-3 py-unit-2 font-headline text-label-md text-on-error-container">
          {error}
        </p>
      )}
      {done && (
        <p className="rounded-lg border border-primary/20 bg-primary-container/15 px-unit-3 py-unit-2 font-headline text-label-md text-on-primary-container">
          Kata sandi berhasil diubah. Mengalihkan ke halaman masuk...
        </p>
      )}

      <div className="space-y-unit-2">
        <label
          htmlFor="password"
          className="block px-unit-1 font-headline text-label-md text-on-surface-variant"
        >
          Kata Sandi Baru
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={show ? "text" : "password"}
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="Minimal 8 karakter"
            disabled={busy || done}
            className="font-body text-body-md w-full rounded-lg border border-outline-variant bg-surface py-unit-4 pr-12 pl-unit-4 text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className="absolute top-1/2 right-unit-3 -translate-y-1/2 text-outline hover:text-on-surface"
            aria-label={show ? "Sembunyikan" : "Tampilkan"}
          >
            <span className="material-symbols-outlined text-[20px]">
              {show ? "visibility_off" : "visibility"}
            </span>
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={busy || done}
        className="flex w-full items-center justify-center gap-unit-2 rounded-lg bg-primary-container py-unit-4 font-headline text-body-md font-bold text-on-primary-container shadow-md transition-all hover:bg-[#00c07a] hover:shadow-lg active:scale-[0.98] disabled:opacity-80"
      >
        {busy ? (
          <span className="material-symbols-outlined animate-spin text-[20px]">
            progress_activity
          </span>
        ) : (
          "Simpan Kata Sandi Baru"
        )}
      </button>
    </form>
  );
}

/**
 * Form reset kata sandi (client) — dibungkus Suspense karena useSearchParams.
 */
export function ResetPasswordForm() {
  return (
    <Suspense
      fallback={
        <p className="text-center text-on-secondary-container">Memuat...</p>
      }
    >
      <ResetPasswordInner />
    </Suspense>
  );
}
