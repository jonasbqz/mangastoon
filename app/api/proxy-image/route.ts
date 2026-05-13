import { NextRequest, NextResponse } from "next/server";
import http from "node:http";
import https from "node:https";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const TIMEOUT_MS = 12000;
const insecureHttpsAgent = new https.Agent({ rejectUnauthorized: false });
const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function fetchImageBuffer(url: URL) {
  return new Promise<{ buffer: Buffer; contentType: string }>((resolve, reject) => {
    const client = url.protocol === "http:" ? http : https;
    const request = client.get(
      url,
      {
        timeout: TIMEOUT_MS,
        headers: {
          "User-Agent": BROWSER_USER_AGENT,
          Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
          Referer: `${url.origin}/`,
        },
        ...(url.protocol === "https:" ? { agent: insecureHttpsAgent } : {}),
      },
      (response) => {
        if ((response.statusCode ?? 500) >= 400) {
          response.resume();
          reject(new Error(`IMAGE_UPSTREAM_${response.statusCode}`));
          return;
        }

        const chunks: Buffer[] = [];
        response.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        response.on("end", () => {
          resolve({
            buffer: Buffer.concat(chunks),
            contentType: response.headers["content-type"]?.toString() || "image/jpeg",
          });
        });
      }
    );

    request.on("timeout", () => request.destroy(new Error("IMAGE_PROXY_TIMEOUT")));
    request.on("error", reject);
  });
}

export async function GET(request: NextRequest) {
  const rawUrl = request.nextUrl.searchParams.get("url");

  if (!rawUrl) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  let imageUrl: URL;

  try {
    imageUrl = new URL(rawUrl);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  if (imageUrl.protocol !== "https:" && imageUrl.protocol !== "http:") {
    return NextResponse.json({ error: "Unsupported protocol" }, { status: 400 });
  }

  try {
    const { buffer, contentType } = await fetchImageBuffer(imageUrl);

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch {
    return NextResponse.json({ error: "Image proxy failed" }, { status: 502 });
  }
}
