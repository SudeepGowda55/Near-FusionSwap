import type { Metadata, Viewport } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Cursor, SmoothScroll } from "@/components/site/Motion";
import { TransitionProvider } from "@/components/site/Transition";
import { Footer, Nav } from "@/components/site/Nav";
import { OG_IMAGE, SITE_NAME, SITE_PITCH, SITE_URL } from "@/lib/site";

const display = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_NAME} · Two locks, one secret`, template: `%s · ${SITE_NAME}` },
  description: SITE_PITCH,
  alternates: { canonical: "/" },
  openGraph: { title: SITE_NAME, description: SITE_PITCH, url: "/", siteName: SITE_NAME, images: [OG_IMAGE] },
  twitter: { card: "summary_large_image", title: SITE_NAME, description: SITE_PITCH, images: [OG_IMAGE.url] },
};

export const viewport: Viewport = { themeColor: "#08080d" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${display.variable} ${mono.variable} antialiased`}>
        <Providers>
          <TransitionProvider>
            <Nav />
            <main>{children}</main>
            <Footer />
          </TransitionProvider>
          <SmoothScroll />
          <Cursor />
        </Providers>
      </body>
    </html>
  );
}
