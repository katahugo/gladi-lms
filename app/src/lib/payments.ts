import crypto from "node:crypto";

/**
 * Helper payment gateway — PRD §3 & C4.
 *
 * Keputusan: dukung Midtrans (Snap) sebagai gateway utama dengan webhook
 * signature verification. Xendit bisa ditambahkan dengan interface serupa.
 *
 * Membutuhkan env:
 *   MIDTRANS_SERVER_KEY   — server key dari dashboard Midtrans
 *   MIDTRANS_CLIENT_KEY   — client key (untuk Snap popup di frontend)
 *   MIDTRANS_IS_PRODUCTION — "true" untuk production, selain itu sandbox
 */

const SERVER_KEY = process.env.MIDTRANS_SERVER_KEY;
const IS_PROD = process.env.MIDTRANS_IS_PRODUCTION === "true";

export function isMidtransConfigured(): boolean {
  return Boolean(SERVER_KEY);
}

function snapBase(): string {
  return IS_PROD
    ? "https://app.midtrans.com/snap/v1"
    : "https://app.sandbox.midtrans.com/snap/v1";
}

export interface CreateTransactionResult {
  token: string;
  redirectUrl: string;
  orderId: string;
}

/** Buat transaksi Snap di Midtrans, kembalikan token + redirect URL. */
export async function createSnapTransaction(params: {
  orderId: string;
  grossAmount: number;
  customerName: string;
  customerEmail: string;
  itemName: string;
}): Promise<CreateTransactionResult> {
  if (!SERVER_KEY) throw new Error("MIDTRANS_SERVER_KEY belum diset");

  const auth = Buffer.from(`${SERVER_KEY}:`).toString("base64");
  const res = await fetch(`${snapBase()}/transactions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify({
      transaction_details: {
        order_id: params.orderId,
        gross_amount: params.grossAmount,
      },
      customer_details: {
        first_name: params.customerName,
        email: params.customerEmail,
      },
      item_details: [
        {
          id: params.orderId,
          price: params.grossAmount,
          quantity: 1,
          name: params.itemName.substring(0, 50),
        },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Midtrans create transaction gagal (${res.status}): ${text}`);
  }
  const json = (await res.json()) as { token: string; redirect_url: string };
  return { token: json.token, redirectUrl: json.redirect_url, orderId: params.orderId };
}

/**
 * Verifikasi signature webhook Midtrans (WAJIB — PRD §5.5).
 * signature_key = SHA512(order_id + status_code + gross_amount + server_key)
 */
export function verifyMidtransSignature(payload: {
  order_id: string;
  status_code: string;
  gross_amount: string;
  signature_key: string;
}): boolean {
  if (!SERVER_KEY) return false;
  const raw = `${payload.order_id}${payload.status_code}${payload.gross_amount}${SERVER_KEY}`;
  const expected = crypto.createHash("sha512").update(raw).digest("hex");
  // timingSafeEqual untuk mencegah timing attack
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(payload.signature_key ?? "", "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Petakan status Midtrans ke status transaksi internal. */
export function mapMidtransStatus(transactionStatus: string, fraudStatus?: string): "pending" | "paid" | "failed" | "expired" {
  if (transactionStatus === "capture") {
    return fraudStatus === "challenge" ? "pending" : "paid";
  }
  if (transactionStatus === "settlement") return "paid";
  if (transactionStatus === "pending") return "pending";
  if (transactionStatus === "expire") return "expired";
  // deny, cancel, failure, refund
  return "failed";
}
