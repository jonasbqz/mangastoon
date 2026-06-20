import { NextRequest, NextResponse } from "next/server";
import { publishUrlToGoogle } from "../../../utils/google-indexing";

export async function POST(request: NextRequest) {
  try {
    // Simple authorization check
    const apiKey = request.headers.get("x-api-key");
    const expectedKey = process.env.INDEXING_API_KEY;
    if (expectedKey && apiKey !== expectedKey) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json() as { url?: string; type?: "URL_UPDATED" | "URL_DELETED" };
    const { url, type = "URL_UPDATED" } = body;

    if (!url) {
      return NextResponse.json({ error: "Missing required parameter: url" }, { status: 400 });
    }

    const result = await publishUrlToGoogle(url, type);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 502 });
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
