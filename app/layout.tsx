import type { Metadata, Viewport } from "next";
import { Inter, Outfit } from "next/font/google";
import AppFeedback from "./components/app-feedback";
import Footer from "./components/Footer";
import { LanguageProvider } from "./components/language-provider";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

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
  metadataBase: new URL(siteUrl),
  title: {
    template: "%s | MangaStoon",
    default: "MangaStoon - Lee tus mangas favoritos online",
  },
  description:
    "Explora y lee los mejores mangas, manhwas y comics online en alta calidad. Actualizaciones diarias en Espanol, Ingles y Portugues.",
  keywords: ["manga", "manhwa", "leer manga online", "mangadex", "anime", "comics"],
  openGraph: {
    title: "MangaStoon - Lee tus mangas favoritos",
    description: "El mejor catalogo de manga online sin anuncios molestos.",
    siteName: "MangaStoon",
    type: "website",
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
