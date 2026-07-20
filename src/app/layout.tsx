import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { site } from "@/lib/site";
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
  metadataBase: new URL(`https://${site.domain}`),
  title: {
    default: "ShiftCut — Let your AI edit your videos",
    template: "%s — ShiftCut",
  },
  description:
    "Open any video, tell Claude Code, Cursor, or Codex what you want, and ShiftCut does the editing — right on your machine. CapCut on autopilot. Free and open source.",
  keywords: [
    "AI video editor",
    "edit video with AI",
    "Claude Code video editor",
    "Cursor video editing",
    "CapCut alternative",
    "talk to AI to edit video",
    "open source video editor",
  ],
  openGraph: {
    title: "ShiftCut — Let your AI edit your videos",
    description:
      "Open any video. Tell your AI what you want. Get it back edited. CapCut on autopilot — free, open source, and running on your machine.",
    url: `https://${site.domain}`,
    siteName: "ShiftCut",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ShiftCut — Let your AI edit your videos",
    description:
      "Open any video, tell your AI what you want, and it does the editing. CapCut on autopilot. Works with Claude Code, Cursor, Codex, and Gemini CLI.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-bg text-fg">{children}</body>
    </html>
  );
}
