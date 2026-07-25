"use client";

import { FormEvent, useState } from "react";

type Status = "idle" | "loading" | "sent" | "error";

/**
 * Form lupa kata sandi — POST /api/auth/forgot-password.
 */
export function ForgotPasswordForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);
    setStatus("loading");

    const email = String(new FormData(e.currentTarget).get("email") ?? "").trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setStatus("error");
      setMessage("Format email tidak valid.");
      return;
    }

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Gagal mengirim instruksi.");

      setStatus("sent");
      setMessage(
        "Jika email terdaftar, instruksi pemulihan telah dikirim. Periksa kotak masuk Anda.",
      );
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Terjadi kesalahan.");
    }
  }

  const buttonLabel =
    status === "loading"
      ? "Mengirim..."
      : status === "sent"
        ? "Instruksi Terkirim!"
        : "Kirim Instruksi Pemulihan";

  return (
    <form onSubmit={onSubmit} className="w-full space-y-unit-6">
      <div className="space-y-unit-2">
        <label
          htmlFor="email"
          className="block px-unit-1 font-headline text-label-md text-on-surface-variant"
        >
          Alamat Email
        </label>
        <div className="group relative">
          <div className="pointer-events-none absolute inset-y-0 left-unit-4 flex items-center">
            <span className="material-symbols-outlined text-outline transition-colors group-focus-within:text-primary">
              mail
            </span>
          </div>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            autoFocus
            placeholder="nama@perusahaan.com"
            disabled={status === "loading"}
            className="font-body text-body-md w-full rounded-lg border border-outline-variant bg-surface py-unit-4 pr-unit-4 pl-12 text-on-surface outline-none transition-all placeholder:text-on-secondary-container/50 focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-70"
          />
        </div>
      </div>

      {message && (
        <p
          className={`rounded-lg px-unit-3 py-unit-2 font-headline text-label-md ${
            status === "error"
              ? "border border-error/30 bg-error-container/40 text-on-error-container"
              : "border border-primary/20 bg-primary-container/15 text-on-primary-container"
          }`}
        >
          {message}
        </p>
      )}

      <button
        type="submit"
        disabled={status === "loading"}
        className={`group flex w-full items-center justify-center gap-unit-2 rounded-lg py-unit-4 font-headline text-body-md shadow-md transition-all duration-200 hover:shadow-lg active:scale-[0.98] disabled:cursor-wait disabled:opacity-80 ${
          status === "sent"
            ? "bg-tertiary text-on-tertiary"
            : "bg-primary-container text-on-primary-container hover:bg-[#00c07a]"
        }`}
      >
        {status === "loading" ? (
          <span className="material-symbols-outlined animate-spin text-[20px]">
            progress_activity
          </span>
        ) : null}
        <span className="font-bold">{buttonLabel}</span>
        {status !== "loading" && (
          <span className="material-symbols-outlined transition-transform group-hover:translate-x-1">
            arrow_forward
          </span>
        )}
      </button>
    </form>
  );
}
