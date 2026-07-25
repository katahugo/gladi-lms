import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";

import { auth } from "@/auth";
import { LandingHeader } from "@/components/landing-header";
import { db } from "@/db";
import { courses, users } from "@/db/schema";
import { formatRupiah } from "@/lib/courses";

export const dynamic = "force-dynamic";

const WA_NUMBER = process.env.NEXT_PUBLIC_WA_NUMBER ?? "6281234567890";
const WA_HREF = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent("Halo, saya ingin bertanya tentang Gladi.ID")}`;

const HERO_IMG =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBKU3lE0PYjjZutFkJPEorED_dqYb8YNk6o6wjeEBQG_SR6UfZ-qdmD2F7qpewy3WMg4k_FVOJY6wLNXgjMVqiwwZlSPO1UmmI7_N1AnBuxwsxugRkIQd_bjgUY442gib6Q8ozFEeBrY0p8ED8cD1Z_xReSWQiM8svLN0a172gelwdDWLOIYJeL6N_ScBeeri_RlrKe0xAUxWwfINYxghlZOe3KzjdgMz0xs_AE9jj9i-FeGGwbMT4rAZhA3sk_xbKgcymhevIrB1Y";

const WHY_IMG_1 =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBQYASoxowZsnexvZ2yiN3Tdz9m8JyQdCTT_IWnLtwUeYMTnWi7cWMJa3jms92eZ-SZTocszm-8Pml_1lc3lfkUGPL8nlF4T3AOAhf2QZwBHzwib84GCDwwLWzfwqsPvfvC0Ekc_f038lQFHlrWgVFYKipbLz8r9peZ5YzAjhgbRpu5WsFrkVTbF9ZWkV1sd68N851gg9mOGqRsjkwCebPF-GefWbaPhv-qWn0eauk8P7qu-L1Zu8RUgOvfV8zSpX1WEGmbTv9Ka0I";

const WHY_IMG_2 =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuC6SDK04qByP7Q2moVuKwvZPjqpvhqaC7oFhB7luXuui-Fo-Ezta4xc_AczK2i7KxjDBH_biUBsGBAaxgtRVMTr021sxbEzVfzp-6zYj1GbWuBKVIrsf6hxC7SC_I2WUoFATj9R3Y0JO9GI7OrW6Ob1Zs2NaTMSQLoQYjmH8guTB5OTMWaRapp6icAPSeh71SW0vRMRkME2hXfqxUGcsNUyQFjdWyUac534gXlv-4LYjTzsmcdAPOQPBjaxSlGICZps4udnIjWQTHc";

const TRUSTED_IMG =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBRc01ohyoH5XqZ-eqFU1Sq7Rsq8JNeU5G43wEFEw3D9ZCM9vYQ1xorB31X1ooYNl9JaewM1P2q0pkAC7iFyww8HklabX9W633iEaaFLmCCIGyUzn04fCoxvmCmJU9_Q-ysEljekgaDr1le9TrEJd5TY49Rq2uiz3ZynHfN-pLisOPspHwcSOS89Q11QB1q1bSlVWvgkd26Yp8-DNP2dkIFYsHE0BARpzmoN1MSMnvd6qSYmIRl9iPLvMDeqTg2B0gnUv29z0gVR0g";

const COURSE_FALLBACK_IMGS = [
  "https://lh3.googleusercontent.com/aida-public/AB6AXuD-f6OBVHpGQQIh79XhOWMpke44XT3anKf8t6pbjKvFA4BDmlny8bOKbx6hrsmyfA56uVy8XOy4SbetZx4RZzpe2ErODI7YS3yzJ23l6fQnAnxWE1iTdHXs6gS-C4RkVSWSCP_7U0nJSX7kes_QXBFtiKeKg6qaxHAZjfuEUqgcA07Ci5lNeGJKFflwEsNTy-KqKWC3OIWEeJABhjgtUSe0ihOyTqV2Cr_TytK6oTbR7JS7RIpWTynEqyET36hGkVicWvTbNNumbhM",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBOUlLuVifIdlLt_Ftc_EM74Czzldjgn0LYuMn5atB4MmWljp0TxtOiJiDrjTGQgktVee3RTvvKU-SxVSCID6Mt1ZfOLU6yiIvTW9yTbh5JwqJ7ZeP_eS_aliPfT--puoZv3KZ-q2z79z_L8z3m_z2fw4ObKYX1nFOFerfl46qaunmlEHR0qJYpp8ELhkBmiLGusNspqVcDArkHJ8qCqkky_ZMdATYRpqhbdt5u296eypSrstAWQgkbGC8QECEUA-J_TxabHFXIgUk",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuAQEaI7iR0adH0VP0kgoYTEbWSr3jlF4i8eg3maWAa161X6envC2vMG5iKKngjdjH9m5EoGJjqBFvzXRbKwCuFWFHO42UM5K-I2qm1Em2mxliZ6ZVMmNGCl-Vjvs-NlL7Ed_Hchf-hFDetnWDS8-LF1cNrEqvQ5k1Qi0MLyZRzTW4-LFicwOLKX1Yn1S_46Klbp2EBFN7vsixDyIm4ab93AwYIh5YJ27o-y-S2tKPCJZSF1Kq0qw4Q23yHzIXRwYAChSFWwAFArIuA",
];

const INSTRUCTOR_FALLBACK_IMGS = [
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBbp8rFcfAYbefnu6mutT5XctmA-dDTk0breHwBwWnKnOi4DaLCtVl76Wr7qZFHiwSIvr1Z6d65kyTrZTcdv6txL0ZiWwv4qI26FhP49vVdzVDrRPC65ghBaGvFAzvCoHsibaHSfAsH2kmTeIBCYF0CPpmCR7Vi_33FDMjUAeZlh3DuEqPPw1q9q9ckcD7DSbgwsm_LWV78cfc2h7Pl4H6c-q3kbIsdMZ7YdbDhyJQjh9fKGLeqDMqTJJu-3kd9qxKxpkT97EiIhx8",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuAN8JJjDnyBg8urD4bWzMqb-Q9snd146ODE_azo0syjEIaCL_Q0H7QV6jOR0UEgj2fYeGDZcAiMiotkt6roawVZ_JL4udsYCHK_Ggk2hDOikZKUZdNqHLKxt-s-DUUSp5WjYUf6cr8Zh5ZZX9zbUXKMxmO9S_THKVuPw0QBWB_STFmcNKXvtJK2nBMzNGcBcD2UYvnxb0ZneImOXuX3UeE5SsG6G8Df8EBoaT_TXOXJK1K_Lgtlqq0KZ7ccemrqHH4Yl1vfzo2TP2w",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuB5VhpDucB9p4QIAIkbxVvtwfsof1kZO828BRIwlKJKu69kIDNUHijuW_-apjEdvNC2meVu9tW2cZ-8vtf0raW5pUPuFCzE3n-g1V4dpPuAS_FGV9K3wDC5YyD_ZYaPXIE7iYPBg-9ygImQeK7L_zWRJ-y0nRU8l2xPFmQ-6Kpb4hsjFB_NpPVVXMo9uHb-f23Y-4wLbLF_384DJrKqxNREH4PTyyN59gP26XXVA_OtXGLwJJ8YjgdJpCId9DBfylKYDtOzZ729GDI",
];

const DEMO_COURSES = [
  {
    id: "demo-1",
    title: "Full-stack React & Node.js Mastery",
    slug: null as string | null,
    category: "Web Development",
    instructorName: "Budi Setiawan",
    price: 499000,
    rating: "4.9",
    reviews: "(2.4k)",
    badge: "Best Seller" as string | null,
  },
  {
    id: "demo-2",
    title: "Deep Learning Essentials for Beginners",
    slug: null,
    category: "AI & Data Science",
    instructorName: "Siti Aminah",
    price: 599000,
    rating: "4.8",
    reviews: "(1.8k)",
    badge: null,
  },
  {
    id: "demo-3",
    title: "AWS Cloud Architecture Fundamentals",
    slug: null,
    category: "Cloud Computing",
    instructorName: "Andi Pratama",
    price: 449000,
    rating: "4.7",
    reviews: "(950)",
    badge: null,
  },
];

const CATEGORIES = [
  { title: "Web Development", icon: "code", count: "240+ Kursus" },
  { title: "Mobile Development", icon: "smartphone", count: "180+ Kursus" },
  { title: "AI & Data Science", icon: "psychology", count: "150+ Kursus" },
  { title: "Cloud Computing", icon: "cloud", count: "120+ Kursus" },
];

/**
 * Landing page (E4) — halaman depan promosi Gladi.ID.
 */
export default async function Home() {
  const session = await auth();

  let featured: {
    id: string;
    title: string;
    slug: string;
    description: string | null;
    price: number;
    category: string | null;
    instructorName: string | null;
    instructorImage: string | null;
  }[] = [];
  let categoryRows: { category: string | null; count: number }[] = [];

  // Development lokal tetap dapat menampilkan landing page saat PostgreSQL
  // belum aktif; production tetap memakai data kursus aktual.
  try {
    [featured, categoryRows] = await Promise.all([
      db
        .select({
          id: courses.id,
          title: courses.title,
          slug: courses.slug,
          description: courses.description,
          price: courses.price,
          category: courses.category,
          instructorName: users.name,
          instructorImage: users.image,
        })
        .from(courses)
        .leftJoin(users, eq(courses.instructorId, users.id))
        .where(eq(courses.status, "published"))
        .orderBy(desc(courses.createdAt))
        .limit(3),
      db
        .select({
          category: courses.category,
          count: sql<number>`count(*)::int`,
        })
        .from(courses)
        .where(eq(courses.status, "published"))
        .groupBy(courses.category),
    ]);
  } catch {
    console.warn("Landing: database tidak tersedia, memakai konten demo.");
  }

  const categoryCountMap = new Map(
    categoryRows
      .filter((r) => r.category)
      .map((r) => [r.category!.toLowerCase(), r.count]),
  );

  const courseCards =
    featured.length > 0
      ? featured.map((c, i) => ({
          id: c.id,
          title: c.title,
          slug: c.slug,
          category: c.category ?? "Kursus",
          instructorName: c.instructorName ?? "Instruktur",
          instructorImage: c.instructorImage,
          price: c.price,
          rating: "4.8",
          reviews: "",
          badge: i === 0 ? "Best Seller" : null,
          image: COURSE_FALLBACK_IMGS[i % COURSE_FALLBACK_IMGS.length],
        }))
      : DEMO_COURSES.map((c, i) => ({
          ...c,
          instructorImage: null as string | null,
          image: COURSE_FALLBACK_IMGS[i],
        }));

  const year = new Date().getFullYear();

  return (
    <div className="min-h-screen overflow-x-hidden bg-background font-body text-on-surface">
      <LandingHeader user={session?.user ?? null} />

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden pt-20 pb-32">
          <div className="absolute inset-0 z-0">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-primary-container/20" />
          </div>
          <div className="relative z-10 mx-auto grid max-w-container-max items-center gap-12 px-margin-mobile md:grid-cols-2 md:px-margin-desktop">
            <div className="space-y-unit-8">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary-fixed px-3 py-1 font-headline text-label-md text-on-primary-fixed">
                <span className="material-symbols-outlined text-[18px]">verified</span>
                Platform Belajar IT Terpercaya
              </div>
              <h1 className="font-headline text-display-lg-mobile leading-tight text-on-surface md:text-display-lg">
                Kuasai Skill IT Masa Depan Bersama{" "}
                <span className="text-primary">Gladi.ID</span>
              </h1>
              <p className="max-w-lg font-body text-body-lg text-on-surface-variant">
                Akselerasi karir teknologi Anda dengan kurikulum berbasis proyek yang
                dirancang oleh para ahli industri di Indonesia.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link
                  href="/courses"
                  className="flex items-center gap-2 rounded-lg bg-primary px-8 py-4 font-headline text-label-md text-on-primary shadow-lg transition-all hover:brightness-110"
                >
                  Mulai Belajar Sekarang
                  <span className="material-symbols-outlined">arrow_forward</span>
                </Link>
                <Link
                  href="/courses"
                  className="rounded-lg border-2 border-primary px-8 py-4 font-headline text-label-md text-primary transition-colors hover:bg-primary-fixed"
                >
                  Lihat Katalog
                </Link>
              </div>
            </div>

            <div className="relative hidden md:block">
              <div className="soft-float aspect-square overflow-hidden rounded-2xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt="Hero" className="h-full w-full object-cover" src={HERO_IMG} />
              </div>
              <div className="glass-card soft-float absolute -bottom-6 -left-6 flex items-center gap-4 rounded-xl p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-fixed text-on-primary-fixed">
                  <span className="material-symbols-outlined">groups</span>
                </div>
                <div>
                  <div className="font-headline text-headline-md text-primary">15k+</div>
                  <div className="font-headline text-[12px] tracking-wider text-on-surface-variant uppercase">
                    Siswa Aktif
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Categories */}
        <section className="bg-surface-container-low py-20">
          <div className="mx-auto max-w-container-max px-margin-mobile md:px-margin-desktop">
            <div className="mb-12 flex items-end justify-between gap-4">
              <div className="space-y-2">
                <h2 className="font-headline text-headline-lg text-on-surface">
                  Kategori Pilihan
                </h2>
                <p className="font-body text-body-md text-on-surface-variant">
                  Pilih jalur karir impianmu dari berbagai disiplin ilmu teknologi.
                </p>
              </div>
              <Link
                href="/courses"
                className="flex items-center gap-1 font-headline text-label-md text-primary hover:underline"
              >
                Lihat Semua <span className="material-symbols-outlined">chevron_right</span>
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-gutter lg:grid-cols-4">
              {CATEGORIES.map((cat) => {
                const liveCount = categoryCountMap.get(cat.title.toLowerCase());
                const countLabel =
                  liveCount != null ? `${liveCount}+ Kursus` : cat.count;
                return (
                  <Link
                    key={cat.title}
                    href={`/courses?category=${encodeURIComponent(cat.title)}`}
                    className="soft-float group cursor-pointer rounded-xl border border-outline-variant bg-surface-container-lowest p-8 transition-all hover:border-primary"
                  >
                    <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-lg bg-primary-fixed text-primary transition-transform group-hover:scale-110">
                      <span className="material-symbols-outlined text-[32px]">{cat.icon}</span>
                    </div>
                    <h3 className="mb-2 font-headline text-headline-md text-on-surface">
                      {cat.title}
                    </h3>
                    <p className="font-headline text-[12px] tracking-wider text-on-surface-variant uppercase">
                      {countLabel}
                    </p>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        {/* Popular courses */}
        <section className="bg-surface py-24">
          <div className="mx-auto max-w-container-max px-margin-mobile md:px-margin-desktop">
            <div className="mb-16 space-y-4 text-center">
              <h2 className="font-headline text-headline-lg text-on-surface">
                Kursus Paling Populer
              </h2>
              <div className="mx-auto h-1.5 w-20 rounded-full bg-primary" />
            </div>
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
              {courseCards.map((c, i) => {
                const href = c.slug ? `/courses/${c.slug}` : "/courses";
                return (
                  <Link
                    key={c.id}
                    href={href}
                    className="soft-float group cursor-pointer overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest"
                  >
                    <div className="relative aspect-video">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        alt={c.title}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        src={c.image}
                      />
                      {c.badge && (
                        <div className="absolute top-4 left-4 rounded-full bg-primary px-3 py-1 font-headline text-[12px] tracking-wider text-on-primary uppercase">
                          {c.badge}
                        </div>
                      )}
                    </div>
                    <div className="space-y-4 p-6">
                      <div className="font-headline text-[12px] tracking-widest text-primary uppercase">
                        {c.category}
                      </div>
                      <h3 className="font-headline text-headline-md leading-snug text-on-surface">
                        {c.title}
                      </h3>
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 overflow-hidden rounded-full border border-outline-variant bg-surface-container-low">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            alt={c.instructorName}
                            className="h-full w-full object-cover"
                            src={
                              c.instructorImage ??
                              INSTRUCTOR_FALLBACK_IMGS[i % INSTRUCTOR_FALLBACK_IMGS.length]
                            }
                          />
                        </div>
                        <span className="text-body-md text-on-surface-variant">
                          {c.instructorName}
                        </span>
                      </div>
                      <div className="flex items-center justify-between border-t border-outline-variant pt-4">
                        <div className="flex items-center gap-1 text-primary">
                          <span
                            className="material-symbols-outlined text-[18px]"
                            style={{ fontVariationSettings: "'FILL' 1" }}
                          >
                            star
                          </span>
                          <span className="font-bold">{c.rating}</span>
                          {c.reviews && (
                            <span className="font-normal text-on-surface-variant">
                              {c.reviews}
                            </span>
                          )}
                        </div>
                        <div className="font-headline text-headline-md text-on-surface">
                          {c.price === 0 ? "Gratis" : formatRupiah(c.price)}
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        {/* Why choose us */}
        <section className="overflow-hidden py-24">
          <div className="mx-auto max-w-container-max px-margin-mobile md:px-margin-desktop">
            <div className="bento-grid">
              <div className="col-span-12 flex flex-col justify-center space-y-6 lg:col-span-5">
                <h2 className="font-headline text-headline-lg text-on-surface">
                  Kenapa Belajar di Gladi.ID?
                </h2>
                <p className="font-body text-body-lg text-on-surface-variant">
                  Kami percaya pendidikan IT berkualitas harus dapat diakses oleh siapa saja
                  dengan metode yang paling efektif untuk industri saat ini.
                </p>
                <div className="space-y-unit-4 pt-4">
                  {[
                    {
                      icon: "school",
                      title: "Professional Mentors",
                      desc: "Belajar langsung dari praktisi yang berpengalaman di startup dan tech-giants.",
                    },
                    {
                      icon: "account_tree",
                      title: "Project-Based Learning",
                      desc: "Kurikulum berbasis proyek nyata untuk portofolio profesional Anda.",
                    },
                    {
                      icon: "badge",
                      title: "Certificates",
                      desc: "Dapatkan sertifikat resmi untuk memvalidasi keahlian teknis Anda.",
                    },
                  ].map((item) => (
                    <div key={item.title} className="flex items-start gap-4">
                      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-primary-fixed text-primary">
                        <span className="material-symbols-outlined">{item.icon}</span>
                      </div>
                      <div>
                        <h4 className="font-headline text-label-md text-primary">{item.title}</h4>
                        <p className="text-body-md text-on-surface-variant">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="relative col-span-12 h-[500px] lg:col-span-7">
                <div className="soft-float absolute top-0 right-0 h-[85%] w-[85%] overflow-hidden rounded-3xl">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt="Kolaborasi siswa"
                    className="h-full w-full object-cover"
                    src={WHY_IMG_1}
                  />
                </div>
                <div className="soft-float absolute bottom-0 left-0 h-[50%] w-[50%] overflow-hidden rounded-3xl border-8 border-background">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt="Siswa coding"
                    className="h-full w-full object-cover"
                    src={WHY_IMG_2}
                  />
                </div>
                <div className="absolute top-1/2 left-1/2 -z-10 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary-fixed-dim opacity-20 blur-[100px]" />
              </div>
            </div>
          </div>
        </section>

        {/* Trusted */}
        <section className="bg-surface-container-lowest py-20">
          <div className="mx-auto max-w-container-max px-margin-mobile text-center md:px-margin-desktop">
            <h2 className="mb-12 font-headline text-headline-lg text-on-surface">
              Dipercaya oleh Perusahaan IT Terkemuka
            </h2>
            <div className="flex flex-wrap items-center justify-center gap-12 opacity-60 grayscale transition-all duration-500 hover:grayscale-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt="Perusahaan terpercaya"
                className="h-12 object-contain md:h-16"
                src={TRUSTED_IMG}
              />
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section className="bg-surface-container-low py-24">
          <div className="mx-auto max-w-container-max px-margin-mobile md:px-margin-desktop">
            <div className="mb-16 text-center">
              <h2 className="font-headline text-headline-lg text-on-surface">
                Apa Kata Mereka?
              </h2>
              <div className="mx-auto mt-4 h-1.5 w-20 rounded-full bg-primary" />
            </div>
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
              {[
                {
                  name: "Andi Saputra",
                  role: "Fullstack Developer di Tech Solutions",
                  quote:
                    "Kurikulum di Gladi.ID sangat relevan dengan kebutuhan industri. Saya berhasil mendapatkan pekerjaan impian saya setelah menyelesaikan bootcamp di sini.",
                  img: "https://lh3.googleusercontent.com/aida-public/AB6AXuA1o8TeaeZA957tPi3M-dfVRzYy_-e4M3uIDXaK4ffbYE4R4csNep9Ar0oS2l1IfziAeNu-_7AJ2eNE9OKlJpnLLjSfTaxIUlex-MoGWV17pKxEtWfEFl2aayE336-DCEiSOdYJOZ5eQIFJ2G5NUrO3fkK5o7v8FVsAadf9NvUSYzH3fCCk0wmPqsylROx-qSDZQu7zcFJyw_LYrteF4Hp6hzmuSsHQZNJsCGQmuDLfpiNsUZ9nRFTtUczXEm-Alw7QNJ4z-dPhTrk",
                },
                {
                  name: "Siti Aminah",
                  role: "Data Scientist",
                  quote:
                    "Instrukturnya sangat berpengalaman dan materi yang diajarkan sangat mendalam. Proyek berbasis portofolio sangat membantu saya memahami konsep secara praktis.",
                  img: "https://lh3.googleusercontent.com/aida-public/AB6AXuAPBxUGNus4oyJyLGZ4hnNDLrVZRPfX2qZPYnGZxfpHMV7biQtaGZzu0SgTxH-I-1xT8wjmLN7fNRT6x3OZrBPnsy6nhduoFcXMSAFhwTnAZBo1oxwjs0fvBM0mnY9PYHezQBy0-GQaAk84QNG9HrXmreOgvgYtitbfhbXVfME4SLkIRZ-BEqZCJxBD8bbKamnIeEAAbg7PbbAW1RolQyGVg-AG-zSnLAzAllPBffRousuIRBwm1pwQ2rzU4jZI9gIW8YzWsuVIlpA",
                },
              ].map((t) => (
                <div
                  key={t.name}
                  className="soft-float flex flex-col gap-6 rounded-lg border border-outline-variant bg-surface-container-lowest p-8"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 overflow-hidden rounded-full border-2 border-primary">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img alt={t.name} className="h-full w-full object-cover" src={t.img} />
                    </div>
                    <div>
                      <h4 className="font-headline text-[20px] text-on-surface">{t.name}</h4>
                      <p className="font-headline text-label-md text-primary">{t.role}</p>
                    </div>
                  </div>
                  <p className="font-body text-body-lg text-on-surface-variant italic">
                    &ldquo;{t.quote}&rdquo;
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="px-margin-mobile py-20 md:px-margin-desktop">
          <div className="relative mx-auto max-w-container-max overflow-hidden rounded-3xl bg-primary p-12 text-center shadow-2xl md:text-left">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent opacity-10" />
            <div className="relative z-10 items-center justify-between gap-12 md:flex">
              <div className="space-y-4">
                <h2 className="font-headline text-display-lg-mobile text-on-primary md:text-display-lg">
                  Siap Memulai Karir IT Kamu?
                </h2>
                <p className="max-w-xl font-body text-body-lg text-on-primary/90">
                  Dapatkan akses ke ratusan kursus gratis dan premium. Daftar sekarang dan
                  mulai belajar hari ini!
                </p>
              </div>
              <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row md:mt-0">
                <Link
                  href="/login"
                  className="rounded-xl bg-on-primary px-10 py-5 font-bold text-primary shadow-lg transition-colors hover:bg-surface-container-low"
                >
                  Daftar Akun Gratis
                </Link>
                <a
                  href={WA_HREF}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl border-2 border-on-primary px-10 py-5 font-bold text-on-primary transition-colors hover:bg-on-primary hover:text-primary"
                >
                  Hubungi Kami
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-on-primary-fixed text-on-primary">
        <div className="mx-auto flex w-full max-w-container-max flex-col items-start justify-between px-margin-mobile py-unit-12 md:flex-row md:px-margin-desktop">
          <div className="mb-12 max-w-xs space-y-6 md:mb-0">
            <div className="font-headline text-headline-md font-bold text-primary-fixed">
              Gladi.ID
            </div>
            <p className="font-body text-body-md text-on-primary/70">
              Empowering Technical Precision. Solusi belajar IT nomor satu di Indonesia
              untuk mencetak talenta digital berstandar global.
            </p>
            <div className="flex gap-4">
              <a
                href="#"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-container/20 transition-colors hover:bg-primary-container/40"
                aria-label="Website"
              >
                <span className="material-symbols-outlined text-[20px]">public</span>
              </a>
              <a
                href="#"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-container/20 transition-colors hover:bg-primary-container/40"
                aria-label="Bagikan"
              >
                <span className="material-symbols-outlined text-[20px]">share</span>
              </a>
            </div>
          </div>
          <div className="grid w-full grid-cols-2 gap-12 lg:grid-cols-3 md:w-auto">
            <div>
              <h4 className="mb-6 font-headline text-label-md tracking-wider text-primary-fixed-dim uppercase">
                Learning Path
              </h4>
              <ul className="space-y-4 font-body text-body-md text-on-primary/60">
                <li>
                  <Link href="/courses" className="transition-colors hover:text-primary-fixed">
                    Web Dev
                  </Link>
                </li>
                <li>
                  <Link href="/courses" className="transition-colors hover:text-primary-fixed">
                    Data Science
                  </Link>
                </li>
                <li>
                  <Link href="/courses" className="transition-colors hover:text-primary-fixed">
                    Cyber Security
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="mb-6 font-headline text-label-md tracking-wider text-primary-fixed-dim uppercase">
                Company
              </h4>
              <ul className="space-y-4 font-body text-body-md text-on-primary/60">
                <li>
                  <a href="#" className="transition-colors hover:text-primary-fixed">
                    About Us
                  </a>
                </li>
                <li>
                  <a href={WA_HREF} className="transition-colors hover:text-primary-fixed">
                    Support
                  </a>
                </li>
                <li>
                  <a href="#" className="transition-colors hover:text-primary-fixed">
                    Terms of Service
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="mb-6 font-headline text-label-md tracking-wider text-primary-fixed-dim uppercase">
                Connect
              </h4>
              <ul className="space-y-4 font-body text-body-md text-on-primary/60">
                <li>
                  <a href="#" className="transition-colors hover:text-primary-fixed">
                    LinkedIn
                  </a>
                </li>
                <li>
                  <a href="#" className="transition-colors hover:text-primary-fixed">
                    Twitter
                  </a>
                </li>
                <li>
                  <a href="#" className="transition-colors hover:text-primary-fixed">
                    Instagram
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>
        <div className="mx-auto w-full max-w-container-max border-t border-on-primary/10 px-margin-mobile py-8 text-center md:px-margin-desktop">
          <p className="font-body text-body-md text-on-primary/40">
            © {year} Gladi.ID. Empowering Technical Precision.
          </p>
        </div>
      </footer>
    </div>
  );
}
