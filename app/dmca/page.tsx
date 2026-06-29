import type { Metadata } from "next";
import LegalPage from "../components/LegalPage";

export const metadata: Metadata = {
  title: "DMCA y reclamaciones de copyright | LectorFenix",
  description: "Información para reportar reclamaciones de copyright y solicitudes DMCA relacionadas con LectorFenix.",
  alternates: {
    canonical: "/dmca",
  },
  robots: {
    index: true,
    follow: true,
  },
};


export default function DmcaPage() {
  return (
    <LegalPage
      pageKey="dmca"
      title={{
        es: "DMCA / Reclamaciones de Copyright",
        en: "DMCA / Copyright Claims",
        pt: "DMCA / Reclamações de Copyright",
      }}
    />
  );
}
