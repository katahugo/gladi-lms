import crypto from "node:crypto";

/**
 * Helper kuis — auto-grading (E1).
 *
 * Menilai jawaban siswa untuk tipe soal yang bisa dinilai otomatis
 * (multiple_choice, true_false). Soal essay dibiarkan null (review manual).
 */

export interface QuizOption {
  id: string;
  text: string;
}

export interface QuestionForGrading {
  id: string;
  type: "multiple_choice" | "true_false" | "essay";
  options: string | null; // JSON array QuizOption
  correctAnswer: string | null;
  points: number;
}

export interface GradingResult {
  /** Skor 0–100 (persen), atau null bila ada essay yang belum dinilai manual. */
  score: number | null;
  /** true bila semua soal bisa dinilai otomatis. */
  fullyAutoGraded: boolean;
  /** Poin yang diperoleh vs total poin yang bisa dinilai otomatis. */
  earnedPoints: number;
  totalPoints: number;
}

export function gradeAnswers(
  questions: QuestionForGrading[],
  answers: Record<string, string>,
): GradingResult {
  let earned = 0;
  let total = 0;
  let hasEssay = false;

  for (const q of questions) {
    if (q.type === "essay") {
      hasEssay = true;
      continue; // essay dinilai manual, tidak masuk perhitungan otomatis
    }
    total += q.points;
    const given = answers[q.id];
    if (given === undefined) continue;

    let correct = false;
    if (q.type === "true_false") {
      correct = String(given).toLowerCase() === String(q.correctAnswer ?? "").toLowerCase();
    } else if (q.type === "multiple_choice") {
      correct = given === q.correctAnswer;
    }
    if (correct) earned += q.points;
  }

  const fullyAutoGraded = !hasEssay;
  // Skor dihitung dari soal yang bisa dinilai otomatis; bila ada essay, skor ditunda (null)
  const score = total > 0 ? Math.round((earned / total) * 100) : fullyAutoGraded ? 100 : null;
  return {
    score: hasEssay ? null : score,
    fullyAutoGraded,
    earnedPoints: earned,
    totalPoints: total,
  };
}

/** Nomor sertifikat unik untuk verifikasi publik: GLD-YYYY-XXXXXX (acak aman). */
export function generateCertificateNumber(): string {
  const year = new Date().getFullYear();
  const rand = crypto.randomBytes(4).toString("hex").toUpperCase().substring(0, 6);
  return `GLD-${year}-${rand}`;
}
