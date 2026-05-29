import { NextRequest, NextResponse } from "next/server";
import { logger } from "../../utils/logger";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();

  if (!query) {
    return NextResponse.json({ error: "The ?q= parameter is required." }, { status: 400 });
  }

  const apiBaseUrl = process.env.MANGAVF_API_URL || process.env.NEXT_PUBLIC_MANGAVF_API_URL || "http://localhost:3001";
  const targetUrl = `${apiBaseUrl}/api/v1/manga/search?q=${encodeURIComponent(query)}`;

  try {
    const response = await fetch(targetUrl);
    if (!response.ok) {
      logger.error(`Search proxy request failed: ${response.status} ${response.statusText}`);
      return NextResponse.json({ error: "Search request failed" }, { status: response.status });
    }
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    logger.error("Error proxying search request", error);
    return NextResponse.json({ error: "An error occurred while proxying search." }, { status: 500 });
  }
}
