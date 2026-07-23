import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Klien MinIO (S3-compatible) untuk materi kursus: PDF, gambar, rubrik, dsb.
 *
 * Membutuhkan env:
 *   S3_ENDPOINT     — http://minio:9000 (internal Docker) atau http://localhost:9000
 *   S3_ACCESS_KEY   — access key MinIO
 *   S3_SECRET_KEY   — secret key MinIO
 *   S3_BUCKET_MEDIA — nama bucket (mis. lms-media)
 *
 * Signed URL dibuat dengan durasi pendek (default 15 menit unduh, 10 menit unggah)
 * sesuai PRD: akses materi tidak lewat URL publik permanen.
 */

const ENDPOINT = process.env.S3_ENDPOINT;
const ACCESS_KEY = process.env.S3_ACCESS_KEY;
const SECRET_KEY = process.env.S3_SECRET_KEY;
const BUCKET = process.env.S3_BUCKET_MEDIA ?? "lms-media";

export function isS3Configured(): boolean {
  return Boolean(ENDPOINT && ACCESS_KEY && SECRET_KEY);
}

function client(): S3Client {
  if (!isS3Configured()) throw new Error("MinIO/S3 belum dikonfigurasi (env S3_* belum diisi)");
  return new S3Client({
    endpoint: ENDPOINT,
    region: "us-east-1", // MinIO mengabaikan region, tapi SDK mewajibkannya
    credentials: { accessKeyId: ACCESS_KEY!, secretAccessKey: SECRET_KEY! },
    forcePathStyle: true, // WAJIB untuk MinIO (bukan virtual-hosted style)
  });
}

/** Pastikan bucket ada (dipakai saat pertama kali upload / provisioning). */
export async function ensureBucket(): Promise<void> {
  const s3 = client();
  try {
    await s3.send(new HeadBucketCommand({ Bucket: BUCKET }));
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: BUCKET }));
  }
}

/** Buat signed URL untuk MENG-UPLOAD (PUT) sebuah objek. */
export async function presignUpload(key: string, contentType: string, expiresInSeconds = 600): Promise<string> {
  const s3 = client();
  return getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType }),
    { expiresIn: expiresInSeconds },
  );
}

/** Buat signed URL untuk MENGUNDUH (GET) sebuah objek. */
export async function presignDownload(key: string, expiresInSeconds = 900): Promise<string> {
  const s3 = client();
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: BUCKET, Key: key }), {
    expiresIn: expiresInSeconds,
  });
}

/** Hapus sebuah objek (mis. saat materi diganti/dihapus). */
export async function deleteObject(key: string): Promise<void> {
  const s3 = client();
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

/** Bangun object key yang rapi & ter-namespace per konteks. */
export function buildKey(kind: "material" | "thumbnail" | "certificate" | "assignment", id: string, filename: string): string {
  const safe = filename.replace(/[^\w.\-]+/g, "_");
  return `${kind}/${id}/${Date.now()}-${safe}`;
}
