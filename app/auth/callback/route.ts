import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://xlcsqqwelopzpslxgdni.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_HXlaIRq65K65Yx9djOtK8Q_NKOFfPvN";

const getSiteURL = () => {
  let url = process.env.NEXT_PUBLIC_SITE_URL ?? "https://mangastoon.com";

  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }

  return url.endsWith("/") ? url.slice(0, -1) : url;
};

const getSafeNextPath = (next: string | null) => {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/profile";
  }

  return next;
};

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const siteURL = origin && origin !== "null" ? origin : getSiteURL();
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next");
  const isAuthVerification = !nextParam || nextParam === "/" || nextParam === "/profile";
  const next = isAuthVerification ? "/auth/verified" : getSafeNextPath(nextParam);

  if (!code) {
    return NextResponse.redirect(new URL("/?error=missing_code", siteURL));
  }

  const response = NextResponse.redirect(new URL(next, siteURL));

  const supabase = createServerClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session) {
    console.error("[auth/callback] error:", error?.message);
    return NextResponse.redirect(new URL("/?error=auth_failed", siteURL));
  }

  const user = data.session.user;
  const provider = user.app_metadata?.provider;

  // ── Poblar perfil desde Discord ──────────────────────────────────────────
  // Si el proveedor es Discord y el perfil aún no tiene username, lo tomamos
  // de los metadatos que Discord envía automáticamente a Supabase.
  if (provider === "discord") {
    const meta = user.user_metadata ?? {};

    // Discord envía: full_name, custom_claims.global_name, user_name, name
    const discordUsername =
      meta.custom_claims?.global_name ??
      meta.full_name ??
      meta.name ??
      meta.user_name ??
      null;

    const avatarUrl = meta.avatar_url ?? meta.picture ?? null;

    if (discordUsername) {
      // Verificar si el perfil ya tiene username antes de sobreescribir
      const { data: existing } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", user.id)
        .single();

      if (!existing?.username) {
        await supabase.from("profiles").upsert({
          id: user.id,
          username: discordUsername,
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString(),
          // username_updated_at vacío en primer ingreso: no bloquear cambio inicial
        });
      }
    }
  }

  return response;
}
