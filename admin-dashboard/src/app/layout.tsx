import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import ReactQueryProvider from "@/providers/ReactQueryProvider";
import { SessionProvider } from "next-auth/react";
import GlobalHeader from "@/components/layout/GlobalHeader";
import GlobalFooter from "@/components/layout/GlobalFooter";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "WholesaleBD — Group Buy Deals in Bangladesh",
  description:
    "Join zero-friction group buy deals. Watch prices cascade as more buyers pledge. Secure authentic products at wholesale rates with bKash, Nagad, or card payments.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`h-full antialiased ${inter.variable}`} data-scroll-behavior="smooth">
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900 font-sans">
        <SessionProvider>
          <ReactQueryProvider>
            <GlobalHeader />
            <main className="flex-1">{children}</main>
            <GlobalFooter />
          </ReactQueryProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
