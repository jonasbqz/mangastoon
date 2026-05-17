import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mis Favoritos",
  robots: {
    index: false,
    follow: false,
  },
};

export default function FavoritosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
