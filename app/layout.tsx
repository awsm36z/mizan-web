import type { Metadata } from "next";
import "./globals.css";
import { LangProvider } from "@/components/LangProvider";

// Fonts loaded via the same Google Fonts stack the HTML prototype used
// (Fraunces for the brand mark/headings, Inter for the LTR interface,
// IBM Plex Sans Arabic for AR/DAR — see globals.css's html[dir="rtl"]
// font-family rule). A <link> tag (rather than next/font) is used here so
// all three families' exact weights match the source's one <link> call
// precisely.

export const metadata: Metadata = {
  title: "Mizan",
  description: "Mizan — Moroccan Faraid share calculator and draft Iratha heirship-statement generator.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Inter:wght@400;500;600;700&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <LangProvider>{children}</LangProvider>
      </body>
    </html>
  );
}
