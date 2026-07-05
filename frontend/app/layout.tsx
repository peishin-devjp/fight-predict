import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Fight-Predict",
  description: "格闘技勝敗予想サイト",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="border-b p-4">
           Fight Predict
        </header>

        <main className="flex-1">
          {children}
        </main>

        <footer className="border-t p-4 text-center text-sm text-gray-500">
          @ 2026 Fight Predict
        </footer>
      </body>
    </html>
  );
}
