import type { Metadata } from "next";
import { DM_Mono, DM_Sans } from "next/font/google";
import "./globals.css";
import AllProvider from "@/contexts/all-provider";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
});

const DESCRIPTION =
  "Plan, schedule and publish posts to Instagram, TikTok, YouTube, LinkedIn, Facebook, Pinterest and Bluesky. Create content in the app or with your AI agent over MCP.";

export const metadata: Metadata = {
  title: {
    default: "Unsora",
    template: "%s · Unsora",
  },
  description: DESCRIPTION,
  metadataBase: new URL("https://app.tryunsora.com"),
  icons: {
    icon: "/brand/logo.png",
    apple: "/brand/logo.png",
  },
  openGraph: {
    siteName: "Unsora",
    title: "Unsora: social media scheduler",
    description: DESCRIPTION,
    type: "website",
    locale: "en_US",
    images: [{ url: "/brand/logo-with-text-dark.png", alt: "Unsora" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Unsora: social media scheduler",
    description: DESCRIPTION,
    images: ["/brand/logo-with-text-dark.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${dmSans.variable} ${dmMono.variable}`}
      >
        <AllProvider>{children}</AllProvider>
      </body>
    </html>
  );
}