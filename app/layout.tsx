import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Toaster } from "@/components/ui/sonner";
import { publicEnv } from "@/lib/env";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.appUrl),
  title: {
    default: "ApplyDesk — Tailored job applications, organised",
    template: "%s · ApplyDesk",
  },
  description:
    "Create tailored resumes, write compelling cover letters and manage your job search in one intelligent workspace.",
  applicationName: "ApplyDesk",
  openGraph: {
    title: "ApplyDesk",
    description:
      "Create tailored resumes, write compelling cover letters and manage your job search in one intelligent workspace.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#faf9f6",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}>
      <body className="min-h-full bg-background text-foreground">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
