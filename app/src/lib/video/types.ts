/**
 * Abstraksi penyedia video — PRD §6.3 & plan C2.
 *
 * Tujuan: decouple logika aplikasi dari vendor video spesifik agar migrasi
 * ke penyedia lain (atau self-hosted HLS) di masa depan hanya perlu mengganti
 * implementasi interface ini, tanpa menyentuh kode pemanggil.
 *
 * Keputusan awal: Cloudflare Stream (Opsi A PRD §6.3).
 */

export interface DirectUploadResult {
  /** URL tujuan siswa/instruktur meng-upload file video (TUS endpoint). */
  uploadUrl: string;
  /** UID video di sisi penyedia — disimpan di lessons.contentRef. */
  videoId: string;
}

export interface PlaybackInfo {
  /** URL manifest HLS/DASH untuk diputar di player. */
  hlsUrl: string;
  /** URL embed iframe (alternatif paling sederhana). */
  embedUrl: string;
  /** URL thumbnail/poster. */
  thumbnailUrl: string;
}

export interface VideoProvider {
  /** Minta URL direct-upload sekali pakai untuk video baru. */
  createDirectUpload(meta: { name: string; maxDurationSeconds?: number }): Promise<DirectUploadResult>;

  /** Ambil info playback untuk sebuah video yang sudah ter-upload. */
  getPlayback(videoId: string): Promise<PlaybackInfo>;

  /** Hapus video dari penyedia (mis. saat lesson dihapus). */
  delete(videoId: string): Promise<void>;

  /** Status kesiapan video (sedang diproses vs siap diputar). */
  getStatus(videoId: string): Promise<"processing" | "ready" | "error">;
}
