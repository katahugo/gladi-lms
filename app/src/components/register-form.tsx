"use client";

import { FormEvent, useState } from "react";

type RegisterFormProps = {
  /** Server action: login credentials setelah registrasi sukses. */
  onRegistered: (email: string, password: string) => Promise<void>;
};

/**
 * Form registrasi — POST /api/register lalu auto login (server action).
 */
export function RegisterForm({ onRegistered }: RegisterFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const form = e.currentTarget;
    const data = new FormData(form);
    const name = String(data.get("name") ?? "").trim();
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");
    const terms = data.get("terms");

    if (name.length < 2) return setError("Nama minimal 2 karakter.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
      return setError("Format email tidak valid.");
    if (password.length < 8) return setError("Kata sandi minimal 8 karakter.");
    if (!terms) return setError("Anda harus menyetujui Ketentuan Layanan.");

    setBusy(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(json.error ?? "Registrasi gagal. Coba lagi.");
      }
      setDone(true);
      // Auto login via server action (akan redirect ke /dashboard).
      await onRegistered(email, password);
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : "Terjadi kesalahan.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-unit-6">
      {error && (
        <p className="rounded-lg border border-error/30 bg-error-container/40 px-unit-3 py-unit-2 font-headline text-label-md text-on-error-container">
          {error}
        </p>
      )}

      <div className="space-y-unit-1">
        <label htmlFor="name" className="font-headline text-label-md text-on-surface-variant">
          Nama Lengkap
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          autoComplete="name"
          placeholder="John Doe"
          className="w-full rounded-lg border border-outline-variant bg-white px-4 py-3 text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary-container"
        />
      </div>

      <div className="space-y-unit-1">
        <label htmlFor="email" className="font-headline text-label-md text-on-surface-variant">
          Email Kerja
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="nama@perusahaan.com"
          className="w-full rounded-lg border border-outline-variant bg-white px-4 py-3 text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary-container"
        />
      </div>

      <div className="space-y-unit-1">
        <label htmlFor="password" className="font-headline text-label-md text-on-surface-variant">
          Kata Sandi
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            required
            autoComplete="new-password"
            placeholder="••••••••"
            className="w-full rounded-lg border border-outline-variant bg-white px-4 py-3 pr-11 text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary-container"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute top-1/2 right-3 -translate-y-1/2 text-outline transition-colors hover:text-on-surface"
            aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
          >
            <span className="material-symbols-outlined text-[20px]">
              {showPassword ? "visibility_off" : "visibility"}
            </span>
          </button>
        </div>
      </div>

      <div className="flex items-start gap-unit-2">
        <input
          id="terms"
          name="terms"
          type="checkbox"
          required
          className="mt-1 h-4 w-4 rounded border-outline-variant text-primary focus:ring-primary"
        />
        <label htmlFor="terms" className="text-sm leading-relaxed text-on-surface-variant">
          Saya setuju dengan{" "}
          <span className="font-semibold text-primary">Ketentuan Layanan</span> dan{" "}
          <span className="font-semibold text-primary">Kebijakan Privasi</span>.
        </label>
      </div>

      <div className="space-y-unit-4">
        <button
          type="submit"
          disabled={busy}
          className="primary-gradient flex w-full items-center justify-center rounded-lg py-unit-3 font-bold text-white shadow-md transition-all hover:shadow-lg active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-80"
        >
          {busy ? (
            <span className="material-symbols-outlined animate-spin text-xl">sync</span>
          ) : (
            "Buat Akun"
          )}
        </button>
      </div>

      {done && !error && (
        <p className="flex items-center justify-center gap-2 text-sm font-medium text-primary">
          <span className="material-symbols-outlined text-[20px]">check_circle</span>
          Akun berhasil dibuat! Mengalihkan...
        </p>
      )}
    </form>
  );
}
