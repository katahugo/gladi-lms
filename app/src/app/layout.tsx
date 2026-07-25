import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
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

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: {
    default: "Gladi.ID | Kuasai Skill IT Masa Depan",
    template: "%s | Gladi.ID",
  },
  description:
    "Akselerasi karir teknologi Anda dengan kurikulum berbasis proyek yang dirancang oleh para ahli industri di Indonesia.",
  metadataBase: new URL(process.env.APP_URL ?? "https://gladi.id"),
  openGraph: {
    siteName: "Gladi.ID",
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
      className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} scroll-smooth h-full antialiased`}
    >
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="flex min-h-full flex-col overflow-x-hidden bg-zinc-950 font-body text-zinc-100">
        {children}
        <WhatsAppFloat />
      </body>
    </html>
  );
}
