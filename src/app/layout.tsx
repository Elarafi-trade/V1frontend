import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import LandingNav from "@/components/LandingNav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ElaraFi V1",
  description: "Advanced trading platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>
          {/* Fixed navbar at the top */}
          <div className="fixed top-0 left-0 right-0 z-50">
            <LandingNav />
          </div>
          
          {/* Main content with padding to account for fixed navbar */}
          <main className="pt-16">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
