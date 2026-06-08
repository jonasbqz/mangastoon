import { NextResponse } from "next/server";
import { getDailyTelegramCode } from "../../../actions/profile";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // Proteger con CRON_SECRET de Dokploy para evitar ejecuciones externas no deseadas
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHANNEL_ID || "-1003763338725";

  if (!token) {
    return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN not configured" }, { status: 500 });
  }

  const codeToday = getDailyTelegramCode(0);

  // Mensaje estético premium en español con formato Markdown
  const messageText = `👑 *MangaStoon Premium Free Pass* 👑\n\n` +
    `🎁 ¡Reclamá tu pase de regalo diario gratis!\n\n` +
    `🔑 El código de hoy es:\n` +
    `👉 \`${codeToday}\` 👈\n\n` +
    `*¿Cómo usarlo?*\n` +
    `1. Ingresá a tu perfil en la web.\n` +
    `2. Hacé clic en *Reclamar Pase Gratis*.\n` +
    `3. Pegá este código y ¡listo! Disfrutá de lectura 100% libre de anuncios, descargas en PDF ilimitadas y configuraciones Pro.\n\n` +
    `🌐 [Entrar a MangaStoon](https://mangastoon.com/)`;

  const telegramUrl = `https://api.telegram.org/bot${token}/sendMessage`;

  try {
    const response = await fetch(telegramUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: messageText,
        parse_mode: "Markdown",
        disable_web_page_preview: true,
      }),
    });

    const result = await response.json();

    if (!response.ok || !result.ok) {
      console.error("[SendDailyCode API] Telegram API error:", result);
      return NextResponse.json({ error: "Failed to send message to Telegram", details: result }, { status: 502 });
    }

    return NextResponse.json({ success: true, code: codeToday, message: "Code sent successfully to Telegram" });
  } catch (error) {
    console.error("[SendDailyCode API] exception:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
