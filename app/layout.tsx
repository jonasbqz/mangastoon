import type { Metadata, Viewport } from "next";
import { Inter, Outfit } from "next/font/google";
import AppFeedback from "./components/app-feedback";
import Footer from "./components/Footer";
import { LanguageProvider } from "./components/language-provider";
import { SITE_DESCRIPTION, SITE_IMAGE, SITE_NAME, SITE_URL } from "./utils/seo";
import "./globals.css";

const bodyFont = Inter({
  subsets: ["latin"],
  variable: "--font-body",
});

const headingFont = Outfit({
  subsets: ["latin"],
  variable: "--font-heading",
  weight: ["500", "600", "700", "800"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    template: `%s | ${SITE_NAME}`,
    default: `${SITE_NAME} - Lee tus mangas favoritos online`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "MangaStoon",
    "manga online",
    "manhwa online",
    "manhua online",
    "leer manga gratis",
    "leer manga online",
    "manga en español",
    "manga en inglés",
    "manga en portugués",
    "comics online",
    "MangaDex",
  ],
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: {
      template: `%s | ${SITE_NAME}`,
      default: `${SITE_NAME} - Lee tus mangas favoritos`,
    },
    description: SITE_DESCRIPTION,
    siteName: SITE_NAME,
    type: "website",
    url: "/",
    images: [
      {
        url: SITE_IMAGE,
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} - manga online`,
      },
    ],
    locale: "es_ES",
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} - Lee tus mangas favoritos`,
    description: SITE_DESCRIPTION,
    images: [SITE_IMAGE],
  },
  icons: {
    icon: "/icon.svg",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": 0,
      "max-image-preview": "large",
      "max-snippet": 155,
    },
  },
  other: {
    monetag: "4022d02a52caca255fe36d90c0a054af",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${headingFont.variable} ${bodyFont.variable} antialiased`}
      >
        <LanguageProvider>
          {children}
          <Footer />
          <AppFeedback />
        </LanguageProvider>
      </body>
    </html>
  );
}
