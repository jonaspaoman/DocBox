import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { PatientProvider } from "@/context/PatientContext";
import { NavBar } from "@/components/NavBar";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DocBox — ER Flow Board",
  description: "Real-time ER patient flow management",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        <NavBar />
        <PatientProvider>{children}</PatientProvider>
      </body>
    </html>
  );
}
