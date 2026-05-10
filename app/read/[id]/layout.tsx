import type { Metadata } from "next";

export async function generateMetadata({ params, searchParams }: { params: Promise<{ id: string }>, searchParams: Promise<{ chapter?: string }> }): Promise<Metadata> {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const chapterId = resolvedSearchParams?.chapter;
  
  if (!chapterId) {
    return { title: "Leer Manga | MangaStoon" };
  }

  // Generamos un titulo basico SEO-friendly para el capitulo
  return {
    title: `Leer Capitulo Online | MangaStoon`,
    alternates: {
      canonical: `${process.env.NEXT_PUBLIC_SITE_URL}/read/${id}?chapter=${chapterId}`
    }
  };
}

export default function ReadLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
