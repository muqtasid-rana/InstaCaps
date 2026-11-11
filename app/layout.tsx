import type { Metadata, Viewport } from "next";
import { AuthProvider } from "@/lib/auth";
import { geist } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "InstaCaps: Roman Urdu + English captions",
  description: "Auto captions for Urdu and English videos, written in Roman Urdu and English and timed to every word.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={geist.variable}>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
