import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Suspense } from "react";
import PageNav from "@/components/PageNav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Sharehouse", template: "%s | Sharehouse" },
  description: "Find a room in a share house, or fill a room in yours.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Reads the current URL, so it sits behind Suspense (Cache Components). */}
        <Suspense fallback={<div aria-hidden="true" className="h-14" />}>
          <PageNav />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
