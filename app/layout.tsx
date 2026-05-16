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
  themeColor: "#ff6b00",
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
    canonical: SITE_URL,
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
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: SITE_NAME,
    statusBarStyle: "black-translucent",
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
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-title": SITE_NAME,
  },
};


const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  potentialAction: {
    "@type": "SearchAction",
    target: `${SITE_URL}/search?q={search_term_string}`,
    "query-input": "required name=search_term_string",
  },
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SITE_NAME,
  url: SITE_URL,
  logo: `${SITE_URL}/icon.svg`,
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
          <script
            id="global-website-jsonld"
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
          />
          <script
            id="global-organization-jsonld"
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
          />
          {children}
          <Footer />
          <AppFeedback />
        </LanguageProvider>
      </body>
    </html>
  );
}
