import type { Metadata, Viewport } from "next";
import { Figtree } from "next/font/google";
import { RegisterServiceWorker } from "@/components/RegisterServiceWorker";
import "./globals.css";

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "RosterHouse",
  description:
    "Shift management for hourly teams — build the schedule, publish it, and your team sees it instantly.",
  // Manifest lives in public/ (not app/manifest.ts) so its color literals
  // stay outside the src design-token lint rules.
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "RosterHouse",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  // RosterHouse Green (--green-800). rgb() because raw hex is linted out of
  // src; keep in sync with theme_color in public/manifest.webmanifest.
  themeColor: "rgb(18, 49, 43)",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={figtree.variable}>
      <body>
        <RegisterServiceWorker />
        {children}
      </body>
    </html>
  );
}
