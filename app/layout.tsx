import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Spoken Shop",
  description: "Sell anything by voice and get paid with PayPal.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-white text-neutral-900">{children}</body>
    </html>
  );
}
