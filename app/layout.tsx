import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import SupabaseSync from "./components/SupabaseSync";
import PenCursor from "./components/PenCursor";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#1f140d",
};

export const metadata: Metadata = {
  title: "Rathinam Global (Deemed to be University) | Exam Cell",
  description: "Academic Management Platform - Manage Academics. Simplify Exams.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // The portal is always shown in the light cream & brown theme (no `dark-theme`).
    // suppressHydrationWarning: page code may add the class again on the client.
    <html lang="en" className={`${inter.variable} ${plusJakarta.variable}`} suppressHydrationWarning>
      <head>
        <link rel="icon" href="/images/rathinam-logo.svg" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  document.documentElement.classList.remove('dark-theme');
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body>
        <SupabaseSync />
        <PenCursor />
        {children}
      </body>
    </html>
  );
}
