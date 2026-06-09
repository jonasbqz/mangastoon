import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const token = "e58f00e8043f429e3e92aa0ecf3e816d80c7b0bc";
  const zoneId = "11014955";
  const version = "1";

  const url = `https://go.transferzenad.com/v3/getTag?token=${token}&zoneId=${zoneId}&version=${version}`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "AntiAdBlock API Client (curl)",
        "Referer": "https://mangastoon.com/"
      },
      next: { revalidate: 1800 } // Cache for 30 minutes matching PHP code TTL
    });

    if (!res.ok) {
      return NextResponse.json({ error: `Upstream returned status ${res.status}` }, { status: 502 });
    }

    const text = await res.text();
    if (text.length < 32) {
      return NextResponse.json({ error: "Invalid response from upstream" }, { status: 502 });
    }

    // First 32 chars are the md5 hash, rest is raw serialized data
    const dataRaw = text.substring(32);
    
    // Parse php serialization s:3:"tag";s:XXX:"<tag>";
    const match = dataRaw.match(/s:3:"tag";s:\d+:"([\s\S]*)"/);
    if (!match) {
      return NextResponse.json({ error: "Failed to parse tag from payload" }, { status: 502 });
    }

    // Unescape quotes and backslashes
    const tag = match[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');

    // Extract host dynamically to update our proxy
    const hostMatch = tag.match(/s\.src='https:\/\/([^/]+)\/tag\.min\.js'/);
    const host = hostMatch ? hostMatch[1] : "al5sm.com";
    
    // Update global state for the stats proxy
    (globalThis as any).currentMonetagHost = host;

    // Rewrite script tag to go through our local proxy
    const rewrittenTag = tag.replace(`https://${host}/tag.min.js`, `/api/v1/stats/tracker`);

    return NextResponse.json({ tag: rewrittenTag });
  } catch (error) {
    console.error("[AdTag API GET] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
