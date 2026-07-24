// =============================================================================
// Load test ringan — Gladi LMS (D5)
// =============================================================================
// Tujuan: membuktikan B2ms (2 vCPU, 8GB RAM) mampu menangani beban dasar
// sebelum go-live publik. Target: < 2.5 detik LCP, < 1% error rate.
//
// Jalankan dengan k6 (install: https://k6.io/docs/get-started/installation/):
//   k6 run scripts/load-test.js
//
// Skenario: 10 virtual user simultan selama 2 menit, ramp-up bertahap,
// mengakses halaman publik (katalog, landing, health) + login simulasi.
// =============================================================================

import http from "k6/http";
import { check, sleep, group } from "k6";

export const options = {
  stages: [
    { duration: "20s", target: 3 },  // ramp-up: 0 → 3 VU
    { duration: "30s", target: 10 }, // ramp-up: 3 → 10 VU
    { duration: "60s", target: 10 }, // steady: 10 VU selama 1 menit
    { duration: "20s", target: 0 },  // ramp-down: 10 → 0 VU
  ],
  thresholds: {
    http_req_duration: ["p(95)<3000"], // 95% request < 3 detik
    http_req_failed: ["rate<0.05"],    // error rate < 5%
    "http_req_duration{url:/courses}": ["p(95)<2500"], // katalog < 2.5s
  },
};

const BASE_URL = __ENV.BASE_URL ?? "https://gladi.id";

export default function () {
  group("Halaman publik", () => {
    // Landing page (halaman terberat — SSR + query DB)
    const home = http.get(`${BASE_URL}/`);
    check(home, { "landing 200": (r) => r.status === 200 });

    // Katalog kursus (PRD: LCP < 2.5 detik)
    const catalog = http.get(`${BASE_URL}/courses`);
    check(catalog, {
      "katalog 200": (r) => r.status === 200,
      "katalog < 2.5s": (r) => r.timings.duration < 2500,
    });

    // Health API (ringan — baseline performa)
    const health = http.get(`${BASE_URL}/api/health`);
    check(health, {
      "health 200": (r) => r.status === 200,
      "health < 500ms": (r) => r.timings.duration < 500,
    });

    // Health DB (cek koneksi database)
    const healthDb = http.get(`${BASE_URL}/api/health/db`);
    check(healthDb, {
      "health/db 200": (r) => r.status === 200,
      "health/db < 1s": (r) => r.timings.duration < 1000,
    });

    // Halaman verifikasi sertifikat
    const verify = http.get(`${BASE_URL}/verify`);
    check(verify, { "verify 200": (r) => r.status === 200 });
  });

  group("Registrasi simulasi", () => {
    const email = `loadtest-${Date.now()}-${__VU}@test.id`;
    const payload = JSON.stringify({
      name: `Load Test ${__VU}`,
      email,
      password: "testpassword123",
    });
    const params = { headers: { "Content-Type": "application/json" } };

    const reg = http.post(`${BASE_URL}/api/register`, payload, params);
    check(reg, {
      "registrasi 201": (r) => r.status === 201,
      "registrasi < 1s": (r) => r.timings.duration < 1000,
    });
  });

  // Jeda antar iterasi (simulasi user nyata)
  sleep(Math.random() * 3 + 1);
}

export function handleSummary(data) {
  const summary = {
    timestamp: new Date().toISOString(),
    base_url: BASE_URL,
    total_requests: data.metrics.http_reqs?.values?.count ?? 0,
    failed_rate: data.metrics.http_req_failed?.values?.rate ?? 0,
    p95_duration_ms: data.metrics.http_req_duration?.values?.["p(95)"] ?? 0,
    avg_duration_ms: data.metrics.http_req_duration?.values?.avg ?? 0,
    thresholds: {
      "http_req_duration p95 < 3000ms": (data.metrics.http_req_duration?.values?.["p(95)"] ?? 0) < 3000,
      "http_req_failed rate < 5%": (data.metrics.http_req_failed?.values?.rate ?? 0) < 0.05,
    },
    verdict:
      (data.metrics.http_req_failed?.values?.rate ?? 1) < 0.05 &&
      (data.metrics.http_req_duration?.values?.["p(95)"] ?? 9999) < 3000
        ? "LULUS"
        : "PERIKSA",
  };
  return { "stdout": JSON.stringify(summary, null, 2) };
}
