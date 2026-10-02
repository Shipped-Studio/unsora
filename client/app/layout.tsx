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

export const metadata: Metadata = {
  title: "Unsora AI",
  description:
    "Unsora AI is a platform for creating and managing your social media content.",
  icons: {
    icon: "/brand/logo.png",
    apple: "/brand/logo.png",
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
        className={`${dmSans.variable} ${dmMono.variable} antialiased font-sans bg-background`}
      >
        <AllProvider>{children}</AllProvider>
      </body>
    </html>
  );
}