import type { Metadata, Viewport } from "next";
import { Inter, Outfit } from "next/font/google";
import { cookies } from "next/headers";
import Script from "next/script";
import AppFeedback from "./components/app-feedback";
import Footer from "./components/Footer";
import BottomNavbar from "./components/BottomNavbar";
import HideOnAdmin from "./components/hide-on-admin";
import { LanguageProvider } from "./components/language-provider";
import PageTransitionLoader from "./components/PageTransitionLoader";
import MangastoonProvider from "./components/MangastoonProvider";
import HeartbeatTracker from "./components/HeartbeatTracker";
import { SITE_DESCRIPTION, SITE_IMAGE, SITE_NAME, SITE_URL, safeJsonLd } from "./utils/seo";
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
  alternates: {
    canonical: "./",
  },
  title: {
    template: `%s | ${SITE_NAME}`,
    default: `${SITE_NAME} - Lee tus mangas favoritos online`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "LectorFenix",
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
  alternateName: ["LectorFenix", "lector fenix", "Lector Fénix"],
  url: SITE_URL,
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  url: SITE_URL,
  logo: `${SITE_URL}/icon.png`,
  name: SITE_NAME,
};


export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const gaId = process.env.NEXT_PUBLIC_GA_ID;
  const cookieStore = await cookies();
  const lang = cookieStore.get("lang")?.value || "es";

  return (
    <html lang={lang} className="dark" suppressHydrationWarning>
      <head>
        {gaId && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
              strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${gaId}', {
                  page_path: window.location.pathname,
                });
              `}
            </Script>
          </>
        )}
        <script
          id="suppress-extension-warnings"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                const originalError = console.error;
                console.error = function(...args) {
                  const msg = args.map(arg => {
                    try {
                      return arg ? String(arg) : '';
                    } catch(e) {
                      return '';
                    }
                  }).join(' ');
                  if (msg.includes('bis_skin_checked') || msg.includes('suppressHydrationWarning')) {
                    return;
                  }
                  originalError.apply(console, args);
                };
              })();
            `
          }}
        />
      </head>
      <body
        suppressHydrationWarning
        className={`${headingFont.variable} ${bodyFont.variable} antialiased`}
      >
        <LanguageProvider>
          <PageTransitionLoader />
          <script
            id="global-website-jsonld"
            type="application/ld+json"
            suppressHydrationWarning
            dangerouslySetInnerHTML={safeJsonLd(websiteJsonLd)}
          />
          <script
            id="global-organization-jsonld"
            type="application/ld+json"
            suppressHydrationWarning
            dangerouslySetInnerHTML={safeJsonLd(organizationJsonLd)}
          />
          <MangastoonProvider />
          <HeartbeatTracker />
          {children}
          <HideOnAdmin>
            <Footer />
            <BottomNavbar />
            <AppFeedback />
          </HideOnAdmin>
        </LanguageProvider>
      </body>
    </html>
  );
}
