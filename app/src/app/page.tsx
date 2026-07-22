export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-6 font-sans">
      <main className="flex w-full max-w-2xl flex-col items-center gap-8 text-center">
        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-sm font-medium text-emerald-400">
          Tahap A4 — Infrastruktur Siap
        </span>
        <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
          Gladi LMS
        </h1>
        <p className="max-w-md text-lg leading-8 text-zinc-400">
          Platform LMS penjualan kursus digital — self-hosted di 1 VPS Azure.
          Next.js + TypeScript + Tailwind + Drizzle ORM.
        </p>
        <div className="flex gap-4">
          <a
            href="/api/health"
            className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-500"
          >
            Cek Health API
          </a>
        </div>
      </main>
    </div>
  );
}
