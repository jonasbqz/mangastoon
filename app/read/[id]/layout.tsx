import type { Metadata } from "next";
import { absoluteUrl } from "../../utils/seo";

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ chapter?: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const chapterId = resolvedSearchParams?.chapter;
  const canonical = chapterId
    ? absoluteUrl(`/read/${id}?chapter=${chapterId}`)
    : absoluteUrl(`/read/${id}`);

  return {
    title: chapterId ? "Leer Capítulo Online | MangaStoon" : "Leer Manga | MangaStoon",
    alternates: {
      canonical,
    },
  };
}

export default function ReadLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
