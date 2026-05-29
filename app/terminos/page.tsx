import type { Metadata } from "next";
import LegalPage from "../components/LegalPage";

export const metadata: Metadata = {
  title: "Términos de servicio | MangaStoon",
  description: "Lee los términos y condiciones de uso de MangaStoon para acceder al lector y sus contenidos.",
  alternates: {
    canonical: "/terminos",
  },
  robots: {
    index: true,
    follow: true,
  },
};


export default function TermsPage() {
  return (
    <LegalPage
      pageKey="terminos"
      title={{
        es: "Términos de Servicio",
        en: "Terms of Service",
        pt: "Termos de Serviço",
      }}
    />
  );
}
