import type {
  DirectUploadResult,
  PlaybackInfo,
  VideoProvider,
} from "./types";

/**
 * Implementasi VideoProvider untuk Cloudflare Stream (PRD §6.3 Opsi A).
 *
 * Menggunakan API REST Cloudflare Stream. Membutuhkan env:
 *   CF_STREAM_ACCOUNT_ID        — Account ID Cloudflare
 *   CF_STREAM_API_TOKEN         — API token dengan izin Stream:Edit
 *   CF_STREAM_CUSTOMER_SUBDOMAIN — subdomain customer (mis. "abc123" dari
 *                                  customer-abc123.cloudflarestream.com)
 */

const ACCOUNT_ID = process.env.CF_STREAM_ACCOUNT_ID;
const API_TOKEN = process.env.CF_STREAM_API_TOKEN;
const SUBDOMAIN = process.env.CF_STREAM_CUSTOMER_SUBDOMAIN;

function apiBase() {
  if (!ACCOUNT_ID) throw new Error("CF_STREAM_ACCOUNT_ID belum diset");
  return `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/stream`;
}

function authHeaders() {
  if (!API_TOKEN) throw new Error("CF_STREAM_API_TOKEN belum diset");
  return { Authorization: `Bearer ${API_TOKEN}` };
}

export function isConfigured(): boolean {
  return Boolean(ACCOUNT_ID && API_TOKEN && SUBDOMAIN);
}

export const cloudflareStreamProvider: VideoProvider = {
  async createDirectUpload({ name, maxDurationSeconds = 3600 }): Promise<DirectUploadResult> {
    const res = await fetch(`${apiBase()}/direct_upload`, {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({
        maxDurationSeconds,
        meta: { name },
        // requireSignedURLs true agar playback butuh token (proteksi konten berbayar)
        requireSignedURLs: true,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Cloudflare Stream direct_upload gagal (${res.status}): ${text}`);
    }
    const json = (await res.json()) as { result: { uid: string; uploadURL: string } };
    return { uploadUrl: json.result.uploadURL, videoId: json.result.uid };
  },

  async getPlayback(videoId): Promise<PlaybackInfo> {
    if (!SUBDOMAIN) throw new Error("CF_STREAM_CUSTOMER_SUBDOMAIN belum diset");
    return {
      hlsUrl: `https://customer-${SUBDOMAIN}.cloudflarestream.com/${videoId}/manifest/video.m3u8`,
      embedUrl: `https://customer-${SUBDOMAIN}.cloudflarestream.com/${videoId}/iframe`,
      thumbnailUrl: `https://customer-${SUBDOMAIN}.cloudflarestream.com/${videoId}/thumbnails/thumbnail.jpg`,
    };
  },

  async delete(videoId): Promise<void> {
    const res = await fetch(`${apiBase()}/${videoId}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    if (!res.ok && res.status !== 404) {
      const text = await res.text();
      throw new Error(`Cloudflare Stream delete gagal (${res.status}): ${text}`);
    }
  },

  async getStatus(videoId): Promise<"processing" | "ready" | "error"> {
    const res = await fetch(`${apiBase()}/${videoId}`, { headers: authHeaders() });
    if (!res.ok) return "error";
    const json = (await res.json()) as {
      result: { status?: { state?: string }; readyToStream?: boolean };
    };
    if (json.result.readyToStream) return "ready";
    const state = json.result.status?.state;
    if (state === "error") return "error";
    return "processing";
  },
};
