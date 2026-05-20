import type { Metadata } from "next";
import { Manrope, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/AuthContext";
import SWRProvider from "@/lib/swr-config";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "PseudoBety",
  description: "Paper money sports betting",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl">
      <body style={{ fontFamily: 'var(--f-ui)' }} suppressHydrationWarning>
        <AuthProvider><SWRProvider>{children}</SWRProvider></AuthProvider>
      </body>
    </html>
  );
}
