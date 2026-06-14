import { NextRequest, NextResponse } from "next/server";
import { getMangaDexRequestHeaders, toMangaDexApiUrl } from "../../../../utils/mangadex-config";
import { isDmcaBlocked } from "../../../../utils/dmca";

export const revalidate = 900;

const RETRY_DELAY_MS = 1200;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string, retries = 1) {
  const response = await fetch(url, {
    headers: getMangaDexRequestHeaders(),
    next: { revalidate: 900 },
  });

  if (response.status === 429 && retries > 0) {
    const retryAfter = Number(response.headers.get("retry-after"));
    await wait(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : RETRY_DELAY_MS);
    return fetchWithRetry(url, retries - 1);
  }

  return response;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ mangaId: string }> }
) {
  const { mangaId } = await params;

  if (isDmcaBlocked(mangaId)) {
    return NextResponse.json(
      { error: "Content removed due to copyright complaint", code: "CONTENT_REMOVED_DMCA" },
      { status: 451 }
    );
  }

  try {
    const response = await fetchWithRetry(
      toMangaDexApiUrl(`/manga/${mangaId}/feed?${request.nextUrl.searchParams.toString()}`)
    );
    const body = await response.text();

    return new NextResponse(body, {
      status: response.status,
      headers: {
        "content-type": response.headers.get("content-type") ?? "application/json",
        "cache-control": "public, max-age=900, stale-while-revalidate=3600",
      },
    });
  } catch {
    return NextResponse.json({ data: [], total: 0 }, { status: 200 });
  }
}
