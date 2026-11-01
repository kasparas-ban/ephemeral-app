import type { Metadata } from "next";
import { Space_Mono } from "next/font/google";

import { ConnectionProvider } from "@/providers/ConnectionProvider";

import "./globals.css";

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Ephemeral",
  description:
    "Type to strangers in real time. Words blur away; nothing is saved.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${spaceMono.variable} antialiased`}>
        <ConnectionProvider>{children}</ConnectionProvider>
      </body>
    </html>
  );
}
