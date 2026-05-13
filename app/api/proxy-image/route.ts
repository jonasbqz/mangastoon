import { Buffer } from "node:buffer";
import http from "node:http";
import https from "node:https";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROXY_VERSION = "node-direct-v2";
const REQUEST_TIMEOUT_MS = 20000;
const MAX_REDIRECTS = 4;
const MAX_RETRIES = 2;

type ImageProxyResult = {
  buffer: Buffer;
  contentType: string;
};

function getBrowserHeaders(targetUrl: URL) {
  return {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
    Referer: `${targetUrl.origin}/`,
    Origin: targetUrl.origin,
    "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
    "Accept-Encoding": "identity",
    "Cache-Control": "no-cache",
    Connection: "close",
    Pragma: "no-cache",
    "Sec-Fetch-Dest": "image",
    "Sec-Fetch-Mode": "no-cors",
    "Sec-Fetch-Site": "same-origin",
  };
}

function getProxyErrorCode(error: unknown) {
  if (typeof error === "object" && error !== null) {
    const record = error as Record<string, unknown>;
    const code = record.code ?? record.statusCode ?? record.status;
    if (typeof code === "string" || typeof code === "number") return String(code);
  }

  if (error instanceof Error) {
    const statusMatch = error.message.match(/status\s+(\d{3})/i);
    if (statusMatch?.[1]) return statusMatch[1];
    return error.message || "UNKNOWN";
  }

  return "UNKNOWN";
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fetchImageBuffer(targetUrl: URL, redirects = 0, attempt = 0): Promise<ImageProxyResult> {
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
        family: 4,
        servername: targetUrl.hostname,
        timeout: REQUEST_TIMEOUT_MS,
        headers: getBrowserHeaders(targetUrl),
      },
      (response) => {
        const statusCode = response.statusCode ?? 0;
        const location = response.headers.location;

        if ([301, 302, 303, 307, 308].includes(statusCode) && location && redirects < MAX_REDIRECTS) {
          response.resume();
          fetchImageBuffer(new URL(location, targetUrl), redirects + 1, attempt).then(resolve).catch(reject);
          return;
        }

        if (statusCode < 200 || statusCode >= 300) {
          response.resume();
          const error = new Error(`Origin image request failed with status ${statusCode}`) as Error & {
            statusCode?: number;
            code?: string;
          };
          error.statusCode = statusCode;
          error.code = String(statusCode);

          if (attempt < MAX_RETRIES) {
            delay(250 * (attempt + 1))
              .then(() => fetchImageBuffer(targetUrl, redirects, attempt + 1))
              .then(resolve)
              .catch(reject);
            return;
          }

          reject(error);
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
      const error = new Error("Origin image request timed out") as Error & { code?: string };
      error.code = "ETIMEDOUT";
      request.destroy(error);
    });

    request.on("error", (error: NodeJS.ErrnoException) => {
      if (attempt < MAX_RETRIES) {
        delay(250 * (attempt + 1))
          .then(() => fetchImageBuffer(targetUrl, redirects, attempt + 1))
          .then(resolve)
          .catch(reject);
        return;
      }

      reject(error);
    });
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawUrl = searchParams.get("url");

  if (!rawUrl) {
    return new NextResponse("Image proxy failed", {
      status: 400,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Proxy-Version": PROXY_VERSION,
        "X-Proxy-Error": "MISSING_URL",
      },
    });
  }

  let targetUrl: URL;

  try {
    targetUrl = new URL(rawUrl);
  } catch {
    return new NextResponse("Image proxy failed", {
      status: 400,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Proxy-Version": PROXY_VERSION,
        "X-Proxy-Error": "INVALID_URL",
      },
    });
  }

  if (targetUrl.protocol !== "https:" && targetUrl.protocol !== "http:") {
    return new NextResponse("Image proxy failed", {
      status: 400,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Proxy-Version": PROXY_VERSION,
        "X-Proxy-Error": "UNSUPPORTED_PROTOCOL",
      },
    });
  }

  try {
    const { buffer, contentType } = await fetchImageBuffer(targetUrl);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
        "X-Proxy-Version": PROXY_VERSION,
      },
    });
  } catch (error) {
    const errorCode = getProxyErrorCode(error);
    console.error("ERROR PROXY:", rawUrl, errorCode, error);

    return new NextResponse("Image proxy failed", {
      status: 502,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Proxy-Version": PROXY_VERSION,
        "X-Proxy-Error": errorCode.slice(0, 180),
      },
    });
  }
}
