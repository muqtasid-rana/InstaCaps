import type { Metadata } from "next";
import { poppins } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Captions — Roman Urdu + English",
  description: "Auto captions for Urdu / English videos, written in Roman Urdu and English.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={poppins.className}>{children}</body>
    </html>
  );
}
