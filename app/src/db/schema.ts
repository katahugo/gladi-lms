import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

// =============================================================================
// ENUMS
// =============================================================================

export const userRole = pgEnum("user_role", [
  "student",
  "instructor",
  "admin",
  "support",
]);

export const courseStatus = pgEnum("course_status", ["draft", "published", "archived"]);

export const lessonType = pgEnum("lesson_type", ["video", "text", "quiz", "assignment"]);

export const enrollmentStatus = pgEnum("enrollment_status", [
  "active",
  "completed",
  "expired",
  "refunded",
]);

export const transactionStatus = pgEnum("transaction_status", [
  "pending",
  "paid",
  "failed",
  "expired",
  "refunded",
]);

export const quizQuestionType = pgEnum("quiz_question_type", [
  "multiple_choice",
  "true_false",
  "essay",
]);

export const attemptStatus = pgEnum("attempt_status", [
  "in_progress",
  "submitted",
  "graded",
]);

// =============================================================================
// AUTH.JS TABLES (NextAuth v5 + Drizzle adapter)
// =============================================================================

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
  // Password hash (bcrypt/argon2) untuk credentials provider; null jika OAuth-only
  passwordHash: text("password_hash"),
  role: userRole("role").notNull().default("student"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // "oauth", "credentials", dll.
    provider: text("provider").notNull(), // "google", dll.
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })],
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

// =============================================================================
// KURSUS & KONTEN
// =============================================================================

export const courses = pgTable(
  "courses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    instructorId: uuid("instructor_id")
      .notNull()
      .references(() => users.id),
    title: text("title").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description"),
    // Harga dalam Rupiah (integer penuh, tanpa desimal) — hindari float untuk uang
    price: integer("price").notNull().default(0),
    category: text("category"),
    thumbnailRef: text("thumbnail_ref"), // object key di MinIO
    status: courseStatus("status").notNull().default("draft"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    index("courses_instructor_idx").on(t.instructorId),
    index("courses_status_idx").on(t.status),
    index("courses_category_idx").on(t.category),
  ],
);

export const modules = pgTable(
  "modules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    index("modules_course_idx").on(t.courseId),
    unique("modules_course_order_unique").on(t.courseId, t.sortOrder),
  ],
);

export const lessons = pgTable(
  "lessons",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    moduleId: uuid("module_id")
      .notNull()
      .references(() => modules.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    type: lessonType("type").notNull(),
    /**
     * Referensi konten — artinya tergantung `type`:
     *   video      → Cloudflare Stream video UID
     *   text       → (null; isi di kolom contentBody)
     *   quiz       → quizzes.id
     *   assignment → object key rubrik di MinIO
     */
    contentRef: text("content_ref"),
    contentBody: text("content_body"), // untuk lesson bertipe text (HTML/markdown)
    durationSeconds: integer("duration_seconds"),
    sortOrder: integer("sort_order").notNull().default(0),
    isFreePreview: boolean("is_free_preview").notNull().default(false),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    index("lessons_module_idx").on(t.moduleId),
    unique("lessons_module_order_unique").on(t.moduleId, t.sortOrder),
  ],
);

// =============================================================================
// ENROLLMENT & PROGRESS
// =============================================================================

export const enrollments = pgTable(
  "enrollments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id),
    status: enrollmentStatus("status").notNull().default("active"),
    enrolledAt: timestamp("enrolled_at", { mode: "date" }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { mode: "date" }),
  },
  (t) => [
    unique("enrollments_user_course_unique").on(t.userId, t.courseId),
    index("enrollments_user_idx").on(t.userId),
    index("enrollments_course_idx").on(t.courseId),
  ],
);

export const progress = pgTable(
  "progress",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    // Persen selesai 0–100
    percentComplete: integer("percent_complete").notNull().default(0),
    // Posisi terakhir video (detik) untuk resume
    lastPositionSeconds: integer("last_position_seconds").notNull().default(0),
    completedAt: timestamp("completed_at", { mode: "date" }),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    unique("progress_user_lesson_unique").on(t.userId, t.lessonId),
    index("progress_user_idx").on(t.userId),
    index("progress_lesson_idx").on(t.lessonId),
  ],
);

// =============================================================================
// KUIS & EVALUASI
// =============================================================================

export const quizzes = pgTable("quizzes", {
  id: uuid("id").defaultRandom().primaryKey(),
  lessonId: uuid("lesson_id")
    .notNull()
    .unique() // 1 lesson quiz = 1 quiz
    .references(() => lessons.id, { onDelete: "cascade" }),
  passingScore: integer("passing_score").notNull().default(70),
  maxAttempts: integer("max_attempts").notNull().default(3),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export const quizQuestions = pgTable(
  "quiz_questions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    quizId: uuid("quiz_id")
      .notNull()
      .references(() => quizzes.id, { onDelete: "cascade" }),
    question: text("question").notNull(),
    type: quizQuestionType("type").notNull().default("multiple_choice"),
    // Pilihan jawaban untuk multiple_choice: JSON array [{"id":"a","text":"..."}]
    options: text("options"),
    // Kunci jawaban: id opsi (mc), "true"/"false" (true_false), null (essay → review manual)
    correctAnswer: text("correct_answer"),
    points: integer("points").notNull().default(1),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("quiz_questions_quiz_idx").on(t.quizId)],
);

export const quizAttempts = pgTable(
  "quiz_attempts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    quizId: uuid("quiz_id")
      .notNull()
      .references(() => quizzes.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    attemptNumber: integer("attempt_number").notNull().default(1),
    // Jawaban siswa: JSON {"questionId": "answer"}
    answers: text("answers"),
    score: integer("score"), // null sampai di-grading (essay butuh manual)
    passed: boolean("passed"),
    status: attemptStatus("status").notNull().default("in_progress"),
    startedAt: timestamp("started_at", { mode: "date" }).notNull().defaultNow(),
    submittedAt: timestamp("submitted_at", { mode: "date" }),
  },
  (t) => [
    index("quiz_attempts_user_idx").on(t.userId),
    index("quiz_attempts_quiz_idx").on(t.quizId),
    unique("quiz_attempts_unique").on(t.quizId, t.userId, t.attemptNumber),
  ],
);

// =============================================================================
// SERTIFIKAT
// =============================================================================

export const certificates = pgTable(
  "certificates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id),
    // Nomor unik untuk halaman verifikasi publik: GLD-YYYY-XXXXXX
    certificateNumber: text("certificate_number").notNull().unique(),
    pdfRef: text("pdf_ref"), // object key PDF di MinIO
    issuedAt: timestamp("issued_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    unique("certificates_user_course_unique").on(t.userId, t.courseId),
    index("certificates_user_idx").on(t.userId),
  ],
);

// =============================================================================
// TRANSAKSI & PEMBAYARAN
// =============================================================================

export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id),
    // Jumlah dalam Rupiah (integer penuh)
    amount: integer("amount").notNull(),
    paymentMethod: text("payment_method"), // qris, gopay, bank_transfer, credit_card, dll.
    status: transactionStatus("status").notNull().default("pending"),
    // Gateway: "midtrans" | "xendit"
    paymentGateway: text("payment_gateway").notNull(),
    // ID order/invoice di sisi gateway — untuk rekonsiliasi & idempotensi webhook
    gatewayRef: text("gateway_ref").notNull().unique(),
    // Token/URL pembayaran dari gateway (snap token / invoice URL)
    paymentUrl: text("payment_url"),
    paidAt: timestamp("paid_at", { mode: "date" }),
    expiredAt: timestamp("expired_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    index("transactions_user_idx").on(t.userId),
    index("transactions_status_idx").on(t.status),
  ],
);

// Catatan implementasi: idempotensi "maksimal satu transaksi paid per user+course"
// ditegakkan via partial unique index SQL mentah di migrasi:
//   CREATE UNIQUE INDEX ... ON transactions(user_id, course_id) WHERE status = 'paid'
// karena Drizzle belum mendukung partial unique index secara deklaratif.

// =============================================================================
// FORUM DISKUSI & RATING
// =============================================================================

export const discussions = pgTable(
  "discussions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    // Thread: null = pertanyaan baru; terisi = balasan (self-reference)
    parentId: uuid("parent_id").references((): AnyPgColumn => discussions.id, {
      onDelete: "cascade",
    }),
    body: text("body").notNull(),
    isResolved: boolean("is_resolved").notNull().default(false),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    index("discussions_lesson_idx").on(t.lessonId),
    index("discussions_parent_idx").on(t.parentId),
    index("discussions_user_idx").on(t.userId),
  ],
);

export const courseReviews = pgTable(
  "course_reviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    rating: integer("rating").notNull(), // 1–5, divalidasi di aplikasi + CHECK di migrasi
    review: text("review"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    unique("course_reviews_user_course_unique").on(t.userId, t.courseId),
    index("course_reviews_course_idx").on(t.courseId),
  ],
);

// =============================================================================
// TYPE EXPORTS (untuk dipakai di kode aplikasi)
// =============================================================================

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Course = typeof courses.$inferSelect;
export type Lesson = typeof lessons.$inferSelect;
export type Enrollment = typeof enrollments.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
