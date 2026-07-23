/**
 * Helper terkait kursus: slug, harga, dsb.
 */

/** Ubah judul menjadi slug URL-friendly yang deterministik. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // hapus diakritik
    .replace(/[^a-z0-9\s-]/g, "") // hanya huruf/angka/spasi/strip
    .replace(/[\s_]+/g, "-") // spasi/underscore → strip
    .replace(/-+/g, "-") // strip beruntun → satu
    .replace(/^-|-$/g, ""); // pangkas strip di ujung
}

/** Format integer Rupiah menjadi string tampilan, mis. 150000 → "Rp150.000". */
export function formatRupiah(amount: number): string {
  return "Rp" + amount.toLocaleString("id-ID");
}
