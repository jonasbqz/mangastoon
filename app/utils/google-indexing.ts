import crypto from "crypto";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_INDEXING_SCOPE = "https://www.googleapis.com/auth/indexing";

function base64url(str: string | Buffer): string {
  const buf = typeof str === "string" ? Buffer.from(str) : str;
  return buf.toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export async function getGoogleIndexingAccessToken(
  clientEmail: string,
  privateKey: string
): Promise<string> {
  const cleanPrivateKey = privateKey.replace(/\\n/g, "\n").trim();

  const header = {
    alg: "RS256",
    typ: "JWT",
  };

  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 3600; // 1 hour expiration

  const payload = {
    iss: clientEmail,
    scope: GOOGLE_INDEXING_SCOPE,
    aud: GOOGLE_TOKEN_URL,
    exp,
    iat,
  };

  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const signer = crypto.createSign("RSA-SHA256");
  signer.update(signingInput);
  const signature = signer.sign(cleanPrivateKey);
  const encodedSignature = base64url(signature);

  const jwt = `${signingInput}.${encodedSignature}`;

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }).toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to retrieve Google OAuth2 access token: ${response.status} ${errorText}`);
  }

  const data = (await response.json()) as { access_token: string };
  return data.access_token;
}

export async function publishUrlToGoogle(
  url: string,
  type: "URL_UPDATED" | "URL_DELETED" = "URL_UPDATED"
): Promise<{ success: boolean; data?: any; error?: string }> {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY;

  if (!email || !key) {
    console.warn("[Google Indexing] Credentials not configured. Skipping indexing ping.");
    return { success: true, error: "CREDENTIALS_MISSING" };
  }

  try {
    const accessToken = await getGoogleIndexingAccessToken(email, key);

    const response = await fetch("https://indexing.googleapis.com/v3/urlNotifications:publish", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        url,
        type,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `Google Indexing API returned status ${response.status}: ${errorText}`,
      };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[Google Indexing] Error publishing URL:", message);
    return { success: false, error: message };
  }
}
