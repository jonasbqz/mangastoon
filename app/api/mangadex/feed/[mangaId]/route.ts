import { NextRequest, NextResponse } from "next/server";
import { getMangaDexRequestHeaders, toMangaDexApiUrl } from "../../../../utils/mangadex-config";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const RETRY_DELAY_MS = 1200;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string, retries = 1) {
  const response = await fetch(url, {
    headers: getMangaDexRequestHeaders(),
    cache: "no-store",
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

  try {
    const response = await fetchWithRetry(
      toMangaDexApiUrl(`/manga/${mangaId}/feed?${request.nextUrl.searchParams.toString()}`)
    );
    const body = await response.text();

    return new NextResponse(body, {
      status: response.status,
      headers: {
        "content-type": response.headers.get("content-type") ?? "application/json",
        "cache-control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ data: [], total: 0 }, { status: 200 });
  }
}
