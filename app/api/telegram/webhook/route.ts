import { NextResponse } from "next/server";
import { getDailyTelegramCode } from "../../../actions/profile";

export async function POST(req: Request) {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN not configured" }, { status: 500 });
    }

    const body = await req.json();
    console.log("[Telegram Webhook] Received update:", JSON.stringify(body));

    const message = body.message;
    if (!message) {
      return NextResponse.json({ ok: true });
    }

    const chatId = message.chat.id;
    const text = message.text ? message.text.trim() : "";

    // ─── 1. NUEVOS MIEMBROS EN EL GRUPO ──────────────────────────────────────
    if (message.new_chat_members && message.new_chat_members.length > 0) {
      for (const member of message.new_chat_members) {
        if (member.is_bot) continue;

        const welcomeText = `👋 *¡Hola ${member.first_name || "MangaLector"}!*\n` +
          `Bienvenido/a a la comunidad oficial de *MangaStoon*.\n\n` +
          `🔑 Si estás acá por el *Pase Premium Gratis*, podés pedir tu código de hoy enviando:\n` +
          `👉 \`/codigo TU_USUARIO\`\n\n` +
          `_(Reemplazá TU_USUARIO con tu nombre de usuario exacto en la web. Si no tenés uno, configuralo en tu perfil)_`;

        await sendTelegramMessage(token, chatId, welcomeText, message.message_id);
      }
      return NextResponse.json({ ok: true });
    }

    // ─── 2. COMANDOS DE TELEGRAM ─────────────────────────────────────────────
    if (text.startsWith("/")) {
      const parts = text.split(/\s+/);
      const command = parts[0].toLowerCase();
      const arg = parts.slice(1).join(" ").trim();

      if (command === "/start") {
        const startText = `👑 *¡Hola ${message.from.first_name || "MangaLector"}!* Soy el bot de MangaStoon.\n\n` +
          `Para conseguir tu código diario único de premium gratis, usá el comando:\n` +
          `👉 \`/codigo TU_USUARIO\`\n\n` +
          `_(Ejemplo: \`/codigo Juan123\`. Podés ver tu nombre de usuario en tu perfil de MangaStoon)_`;

        await sendTelegramMessage(token, chatId, startText, message.message_id);
        return NextResponse.json({ ok: true });
      }

      if (command === "/codigo") {
        if (!arg) {
          const missingArgText = `⚠️ *Falta tu nombre de usuario.*\n\n` +
            `Por favor, ingresá el comando de esta forma:\n` +
            `👉 \`/codigo TU_USUARIO\`\n\n` +
            `_(Reemplazá \`TU_USUARIO\` con tu usuario real de MangaStoon. Podés verlo e ir al perfil desde la web)_`;

          await sendTelegramMessage(token, chatId, missingArgText, message.message_id);
          return NextResponse.json({ ok: true });
        }

        // Generar código único para ese usuario
        const codeToday = await getDailyTelegramCode(arg, 0);

        const codeText = `🔑 *MangaStoon Pase Premium Gratis* 🔑\n\n` +
          `👤 Usuario: *${arg}*\n` +
          `🔑 Código único de hoy:\n` +
          `👉 \`${codeToday}\` 👈\n\n` +
          `*¿Cómo usarlo?*\n` +
          `1. Entrá a tu perfil en MangaStoon.\n` +
          `2. Hacé clic en *Reclamar Pase Gratis*.\n` +
          `3. Pegá este código y ¡listo! Disfrutá de todos los beneficios premium por 24 horas.\n\n` +
          `_(Este código es exclusivo para la cuenta *${arg}*. Si ponés otro usuario en la web, el código no va a funcionar)_`;

        await sendTelegramMessage(token, chatId, codeText, message.message_id);
        return NextResponse.json({ ok: true });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("[Telegram Webhook] Error processing update:", error);
    return NextResponse.json({ error: "Internal Server Error", details: error.message }, { status: 500 });
  }
}

async function sendTelegramMessage(token: string, chatId: number, text: string, replyToMessageId?: number) {
  const telegramUrl = `https://api.telegram.org/bot${token}/sendMessage`;
  try {
    await fetch(telegramUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: "Markdown",
        disable_web_page_preview: true,
        reply_to_message_id: replyToMessageId,
      }),
    });
  } catch (err) {
    console.error("[Telegram Webhook] Failed to send telegram message:", err);
  }
}
