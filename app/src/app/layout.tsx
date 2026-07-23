import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { WhatsAppFloat } from "@/components/whatsapp-float";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Gladi LMS — Platform Kursus Digital",
    template: "%s | Gladi LMS",
  },
  description:
    "Platform LMS penjualan kursus digital: video adaptif, kuis, sertifikat terverifikasi, dan pembayaran mudah.",
  metadataBase: new URL(process.env.APP_URL ?? "https://gladi.id"),
  openGraph: {
    siteName: "Gladi LMS",
    type: "website",
    locale: "id_ID",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-zinc-950 text-zinc-100">
        {children}
        <WhatsAppFloat />
      </body>
    </html>
  );
}
