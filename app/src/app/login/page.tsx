import { signIn } from "@/auth";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";

// searchParams membuat halaman ini dinamis — jangan diprerender statis
export const dynamic = "force-dynamic";

async function LoginError({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  if (!error) return null;
  return (
    <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
      Email atau password salah.
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
        // Kredensial salah → kembali ke login dengan flag error di URL
        const url = new URL("/login", process.env.APP_URL ?? "http://localhost:3000");
        url.searchParams.set("error", "credentials");
        if (params.callbackUrl) url.searchParams.set("callbackUrl", params.callbackUrl);
        redirect(url.toString());
      }
      throw error; // redirect NextAuth melempar NEXT_REDIRECT — wajib di-rethrow
    }
  }

  async function loginGoogle() {
    "use server";
    const params = await searchParams;
    await signIn("google", { redirectTo: params.callbackUrl ?? "/dashboard" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-6">
      <div className="w-full max-w-sm rounded-xl border border-zinc-800 bg-zinc-900 p-8">
        <h1 className="mb-6 text-center text-2xl font-bold text-white">Masuk ke Gladi LMS</h1>

        <Suspense>
          <LoginError searchParams={searchParams} />
        </Suspense>

        <form action={loginCredentials} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm text-zinc-300">
            Email
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white outline-none focus:border-emerald-500"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm text-zinc-300">
            Password
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white outline-none focus:border-emerald-500"
            />
          </label>
          <button
            type="submit"
            className="mt-2 rounded-lg bg-emerald-600 px-4 py-2.5 font-semibold text-white transition-colors hover:bg-emerald-500"
          >
            Masuk
          </button>
        </form>

        <div className="my-5 flex items-center gap-3 text-xs text-zinc-500">
          <span className="h-px flex-1 bg-zinc-800" /> atau <span className="h-px flex-1 bg-zinc-800" />
        </div>

        <form action={loginGoogle}>
          <button
            type="submit"
            className="w-full rounded-lg border border-zinc-700 px-4 py-2.5 font-medium text-zinc-200 transition-colors hover:bg-zinc-800"
          >
            Lanjutkan dengan Google
          </button>
        </form>
      </div>
    </div>
  );
}
