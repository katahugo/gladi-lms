import { cloudflareStreamProvider, isConfigured } from "./cloudflare-stream";
import type { VideoProvider } from "./types";

/**
 * Titik masuk tunggal untuk mendapatkan VideoProvider aktif.
 * Saat ini selalu Cloudflare Stream. Untuk migrasi ke penyedia lain (atau
 * self-hosted HLS), ganti return di sini dengan implementasi baru — pemanggil
 * tidak perlu berubah.
 */
export function getVideoProvider(): VideoProvider {
  return cloudflareStreamProvider;
}

export { isConfigured as isVideoConfigured };
export type { VideoProvider } from "./types";
