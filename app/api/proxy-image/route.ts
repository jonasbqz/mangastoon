import { Buffer } from "node:buffer";
import http from "node:http";
import https from "node:https";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REQUEST_TIMEOUT_MS = 20000;
const MAX_REDIRECTS = 4;

function getBrowserHeaders(targetUrl: URL) {
  return {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
    Referer: `${targetUrl.origin}/`,
    Origin: targetUrl.origin,
    "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    "Sec-Fetch-Dest": "image",
    "Sec-Fetch-Mode": "no-cors",
    "Sec-Fetch-Site": "same-origin",
  };
}

function fetchImageBuffer(targetUrl: URL, redirects = 0): Promise<{ buffer: Buffer; contentType: string }> {
  return new Promise((resolve, reject) => {
    const client = targetUrl.protocol === "http:" ? http : https;
    const agent =
      targetUrl.protocol === "https:"
        ? new https.Agent({ rejectUnauthorized: false })
        : undefined;

    const request = client.get(
      targetUrl,
      {
        agent,
        timeout: REQUEST_TIMEOUT_MS,
        headers: getBrowserHeaders(targetUrl),
      },
      (response) => {
        const statusCode = response.statusCode ?? 0;
        const location = response.headers.location;

        if ([301, 302, 303, 307, 308].includes(statusCode) && location && redirects < MAX_REDIRECTS) {
          response.resume();
          fetchImageBuffer(new URL(location, targetUrl), redirects + 1).then(resolve).catch(reject);
          return;
        }

        if (statusCode < 200 || statusCode >= 300) {
          response.resume();
          reject(new Error(`Origin image request failed with status ${statusCode}`));
          return;
        }

        const chunks: Buffer[] = [];
        response.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        response.on("end", () => {
          resolve({
            buffer: Buffer.concat(chunks),
            contentType: response.headers["content-type"]?.toString() || "image/webp",
          });
        });
      }
    );

    request.on("timeout", () => {
      request.destroy(new Error("Origin image request timed out"));
    });
    request.on("error", reject);
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawUrl = searchParams.get("url");

  if (!rawUrl) {
    return new NextResponse("Missing url parameter", { status: 400 });
  }

  let targetUrl: URL;

  try {
    targetUrl = new URL(rawUrl);
  } catch {
    return new NextResponse("Invalid url parameter", { status: 400 });
  }

  if (targetUrl.protocol !== "https:" && targetUrl.protocol !== "http:") {
    return new NextResponse("Unsupported image protocol", { status: 400 });
  }

  try {
    const { buffer, contentType } = await fetchImageBuffer(targetUrl);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("ERROR PROXY:", rawUrl, error);
    return new NextResponse("Image proxy failed", { status: 502 });
  }
}
