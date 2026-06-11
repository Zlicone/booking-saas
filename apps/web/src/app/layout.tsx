import type { Metadata } from "next";
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import { AuthProvider } from "@/lib/auth-context";
import "./globals.css";

// Karakterni serif za naslove + čist sans za tijelo (izbjegavamo generički Inter)
const display = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-display",
  display: "swap",
});

const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Termin — rezervacije za lokalne biznise",
  description:
    "Upravljaj rasporedom i rezervacijama. Vlastita booking stranica za tvoj biznis.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="hr" className={`${display.variable} ${sans.variable}`}>
      <body className="relative">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
