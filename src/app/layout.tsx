/*
What this file does: Defines the application root layout, metadata, and shared providers.
What calls it: Next.js App Router before any route is rendered.
What it calls: `./globals.css` and `@/components/providers/app-providers`.
What a junior would likely get wrong: Forgetting to wrap client hooks in a provider or leaving generic starter metadata in place.
*/
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import type { ReactNode } from "react";
import { AppProviders } from "@/components/providers/app-providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "VendorOS",
  description: "Procurement workflows and analytics in one internal app.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}

// ⚠️ SENIOR NOTE: Global providers belong here so every route can share the same client cache. If a future route skipped this wrapper, React Query behavior would fragment by route.
