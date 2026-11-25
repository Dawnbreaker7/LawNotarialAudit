import type { Metadata } from "next";
import { JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Notarial Register & Branch Audit System",
  description:
    "Branch Notarial Register and Owner Audit Control Center for GenSan Branch and Malungon Branch.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${plusJakartaSans.variable} ${jetbrainsMono.variable}`}
    >
      <body className="min-h-screen overflow-x-hidden bg-[#F7F4EE] font-sans text-[#1C2434] antialiased print:bg-white print:text-black">
        {children}
      </body>
    </html>
  );
}
