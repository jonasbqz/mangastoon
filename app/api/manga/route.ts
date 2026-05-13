import { NextRequest, NextResponse } from "next/server";
import { getLocalizedTitle } from "../../utils/get-localized-title";
import { getMangaSynopsis, type MangaDexCollectionResponse, type MangaDexManga } from "../../utils/mangadex";
import {
  appendMangaDexAvailableLanguageFilters,
  getMangaDexRequestHeaders,
  toMangaDexApiUrl,
} from "../../utils/mangadex-config";

function getBestCoverUrl(manga: MangaDexManga) {
  const coverArt = manga.relationships?.find((relationship) => relationship.type === "cover_art");
  const fileName = coverArt?.attributes?.fileName;

  return fileName ? `https://uploads.mangadex.org/covers/${manga.id}/${fileName}` : null;
}

async function fetchFromMangaDex(search: string) {
  const params = new URLSearchParams();
  params.set("title", search);
  params.set("limit", "1");
  params.append("includes[]", "cover_art");
  params.set("hasAvailableChapters", "true");
  appendMangaDexAvailableLanguageFilters(params, "es");

  const response = await fetch(toMangaDexApiUrl(`/manga?${params.toString()}`), {
    headers: getMangaDexRequestHeaders(),
    next: { revalidate: 3600 },
  });

  if (!response.ok) {
    throw new Error("MangaDex request failed.");
  }

  const payload = (await response.json()) as MangaDexCollectionResponse;
  return payload.data?.[0] ?? null;
}

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams.get("search")?.trim();

  if (!search) {
    return NextResponse.json({ error: "The ?search= parameter is required." }, { status: 400 });
  }

  try {
    const manga = await fetchFromMangaDex(search);

    if (!manga) {
      return NextResponse.json({ error: "No results were found for that search." }, { status: 404 });
    }

    return NextResponse.json({
      title: getLocalizedTitle(manga, "es"),
      synopsis: getMangaSynopsis(manga, "es"),
      coverImage: getBestCoverUrl(manga),
      malId: null,
      mangaDexId: manga.id,
    });
  } catch (error) {
    console.error("Mangastoon API error:", error);

    return NextResponse.json(
      { error: "An error occurred while querying MangaDex." },
      { status: 500 }
    );
  }
}
