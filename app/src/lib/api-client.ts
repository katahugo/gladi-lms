/**
 * Parse respons fetch sebagai JSON dengan pesan error yang jelas
 * bila server mengembalikan HTML (redirect login / error page).
 */
export async function readJson<T = unknown>(res: Response): Promise<T> {
  const text = await res.text();
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error(`Respons kosong dari server (${res.status})`);
  }
  if (trimmed.startsWith("<!") || trimmed.startsWith("<html")) {
    throw new Error(
      res.status === 401 || res.redirected
        ? "Sesi berakhir — silakan login ulang"
        : `Server mengembalikan halaman HTML (${res.status}), bukan JSON. Coba refresh / login ulang.`,
    );
  }
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    throw new Error(`Respons bukan JSON valid (${res.status})`);
  }
}
