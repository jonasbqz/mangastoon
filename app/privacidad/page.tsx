import type { Metadata } from "next";
import LegalPage from "../components/LegalPage";

export const metadata: Metadata = {
  title: "Política de privacidad | LectorFenix",
  description: "Consulta cómo LectorFenix trata la privacidad, cookies y datos de uso de los usuarios.",
  alternates: {
    canonical: "/privacidad",
  },
  robots: {
    index: true,
    follow: true,
  },
};


export default function PrivacyPage() {
  return (
    <LegalPage
      pageKey="privacidad"
      title={{
        es: "Política de Privacidad",
        en: "Privacy Policy",
        pt: "Política de Privacidade",
      }}
    />
  );
}
