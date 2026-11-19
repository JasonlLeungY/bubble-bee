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
  title: { default: "Bubble Bee", template: "%s | Bubble Bee" },
  description: "Find a room in a share house, or fill a room in yours.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Applies the saved theme before the page paints, so there is no flash. */}
        <script
          dangerouslySetInnerHTML={{
            __html: "try{var t=localStorage.getItem('bubble-bee-theme');if(t=='dark'||t=='light')document.documentElement.setAttribute('data-theme',t)}catch(e){}",
          }}
        />
        {/* Reads the current URL, so it sits behind Suspense (Cache Components). */}
        <Suspense fallback={<div aria-hidden="true" className="h-14" />}>
          <PageNav />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
