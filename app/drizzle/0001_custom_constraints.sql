-- =============================================================================
-- Migrasi kustom: constraint yang tidak bisa dideklarasikan di Drizzle ORM.
-- File ini ditulis manual (bukan auto-generate) — jangan di-overwrite.
-- =============================================================================

-- Idempotensi pembayaran: maksimal SATU transaksi berstatus 'paid' per user+course.
-- Webhook gateway yang datang dua kali tidak akan membuat enrollment ganda.
CREATE UNIQUE INDEX "transactions_paid_unique"
  ON "transactions" USING btree ("user_id", "course_id")
  WHERE "status" = 'paid';--> statement-breakpoint

-- Rating hanya boleh 1–5 bintang.
ALTER TABLE "course_reviews"
  ADD CONSTRAINT "course_reviews_rating_check"
  CHECK ("rating" BETWEEN 1 AND 5);--> statement-breakpoint

-- Persen progress hanya boleh 0–100.
ALTER TABLE "progress"
  ADD CONSTRAINT "progress_percent_check"
  CHECK ("percent_complete" BETWEEN 0 AND 100);--> statement-breakpoint

-- Skor kuis tidak boleh negatif.
ALTER TABLE "quiz_attempts"
  ADD CONSTRAINT "quiz_attempts_score_check"
  CHECK ("score" IS NULL OR "score" >= 0);--> statement-breakpoint
