import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { Urbanist } from "next/font/google";
import { PerformanceProvider } from "./components/PerformanceProvider";
import "./globals.css";

const urbanist = Urbanist({
  subsets: ['latin'],
  weight: ['100', '200', '300', '400', '500', '600', '700', '800', '900'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-urbanist',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://oski.app'),
  title: "OskiHub - EWMBA Dashboard",
  description: "Your Haas daily dashboard: classes, events, and resources in one place.",
  icons: {
    icon: [
      { url: "/OskiHub.ico", sizes: "any", type: "image/x-icon" },
      { url: "/OskiHub.ico", sizes: "16x16", type: "image/x-icon" },
      { url: "/OskiHub.ico", sizes: "32x32", type: "image/x-icon" },
    ],
    shortcut: "/OskiHub.ico",
    apple: "/OskiHub.ico",
  },
  openGraph: {
    title: "OskiHub - EWMBA Dashboard",
    description: "Your Haas daily dashboard: classes, events, and resources in one place.",
    url: "https://oski.app",
    siteName: "OskiHub",
    images: [
      {
        url: "/oskihub-preview.gif", // GIF for platforms that support it
        width: 1200,
        height: 630,
        alt: "OskiHub Dashboard Preview",
        type: "image/gif",
      },
      {
        url: "/oskihub_anim_still.png", // Fallback static image
        width: 1200,
        height: 630,
        alt: "OskiHub Dashboard Preview",
        type: "image/png",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "OskiHub - EWMBA Dashboard",
    description: "Your Haas daily dashboard: classes, events, and resources in one place.",
    images: ["/oskihub_anim_still.png"],
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
      className={`dark ${urbanist.variable}`}
      style={{ 
        colorScheme: 'dark',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        WebkitOverflowScrolling: 'touch'
      }}
      suppressHydrationWarning
      data-theme="dark"
    >
      <head>
        <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet" />
        <style dangerouslySetInnerHTML={{
          __html: `
            html::-webkit-scrollbar,
            body::-webkit-scrollbar {
              display: none !important;
              width: 0 !important;
              height: 0 !important;
            }
            html, body {
              scrollbar-width: none !important;
              -ms-overflow-style: none !important;
            }
          `
        }} />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Force dark mode immediately before render
              (function() {
                document.documentElement.classList.add('dark');
                document.documentElement.setAttribute('data-theme', 'dark');
                document.documentElement.style.colorScheme = 'dark';
              })();
            `,
          }}
        />
      </head>
      <body 
        className={`antialiased dark ${urbanist.className}`} 
        style={{ 
          colorScheme: 'dark',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          overflowX: 'hidden',
          maxWidth: '100%',
          width: '100%'
        }}
      >
        <div className="w-full max-w-full overflow-x-hidden">
          <PerformanceProvider>
            {children}
          </PerformanceProvider>
        </div>
        <Analytics />
      </body>
    </html>
  );
}
