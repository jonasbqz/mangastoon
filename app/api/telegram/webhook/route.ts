import { NextResponse } from "next/server";
import { getDailyTelegramCode } from "../../../actions/profile";

const GROUP_CHAT_ID = "-1003763338725";
const telegramRequestLimitMap = new Map<number, { count: number; date: string }>();

async function isUserAdmin(token: string, userId: number): Promise<boolean> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getChatAdministrators?chat_id=${GROUP_CHAT_ID}`);
    const data = await res.json();
    if (!res.ok || !data.ok) return false;
    const admins = data.result || [];
    return admins.some((admin: any) => admin.user.id === userId);
  } catch {
    return false;
  }
}

async function checkGroupMembership(token: string, userId: number): Promise<boolean> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getChatMember?chat_id=${GROUP_CHAT_ID}&user_id=${userId}`);
    const data = await res.json();
    if (!res.ok || !data.ok) return false;
    const status = data.result?.status;
    return ["member", "administrator", "creator", "restricted"].includes(status);
  } catch {
    return false;
  }
}

async function sendTelegramMessage(token: string, chatId: number, text: string, replyToMessageId?: number): Promise<boolean> {
  const telegramUrl = `https://api.telegram.org/bot${token}/sendMessage`;
  try {
    const res = await fetch(telegramUrl, {
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
    const data = await res.json();
    return res.ok && data.ok;
  } catch (err) {
    console.error("[Telegram Webhook] Failed to send telegram message:", err);
    return false;
  }
}

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
    const senderId = message.from?.id;

    // ─── 1. FILTRO ANTI-SPAM (ENLACES EXTERNOS EN EL GRUPO) ──────────────────
    if (chatId.toString() === GROUP_CHAT_ID && text) {
      const hasExternalLink = text.match(/https?:\/\/[^\s]+/i) && 
                              !text.toLowerCase().includes("mangastoon.com") && 
                              !text.toLowerCase().includes("t.me");
      if (hasExternalLink) {
        const isAdmin = await isUserAdmin(token, senderId);
        if (!isAdmin) {
          // Borrar mensaje de spam
          await fetch(`https://api.telegram.org/bot${token}/deleteMessage?chat_id=${GROUP_CHAT_ID}&message_id=${message.message_id}`);
          return NextResponse.json({ ok: true });
        }
      }
    }

    // ─── 2. NUEVOS MIEMBROS EN EL GRUPO ──────────────────────────────────────
    if (message.new_chat_members && message.new_chat_members.length > 0) {
      for (const member of message.new_chat_members) {
        if (member.is_bot) continue;

        const welcomeText = `👋 *¡Hola ${member.first_name || "MangaLector"}!*\n` +
          `Bienvenido/a a la comunidad oficial de *MangaStoon*.\n\n` +
          `🔑 Si estás acá por el *Pase Premium Gratis*, podés pedir tu código de hoy enviándole un mensaje privado al bot:\n` +
          `👉 [Hablar con el Bot](https://t.me/RaphaelPremiumBot) y escribí el comando:\n` +
          `👉 \`/codigo TU_USUARIO\`\n\n` +
          `_(Reemplazá TU_USUARIO con tu nombre de usuario exacto en la web)_`;

        await sendTelegramMessage(token, chatId, welcomeText, message.message_id);
      }
      return NextResponse.json({ ok: true });
    }

    // ─── 3. COMANDOS DE TELEGRAM ─────────────────────────────────────────────
    if (text.startsWith("/")) {
      const parts = text.split(/\s+/);
      const command = parts[0].toLowerCase();
      const arg = parts.slice(1).join(" ").trim();

      // Comandos de moderación para administradores
      if ((command === "/kick" || command === "/mute") && chatId.toString() === GROUP_CHAT_ID) {
        const isAdmin = await isUserAdmin(token, senderId);
        if (!isAdmin) return NextResponse.json({ ok: true });

        const replyTo = message.reply_to_message;
        if (!replyTo) {
          await sendTelegramMessage(token, chatId, "⚠️ Respondé al mensaje del usuario que querés moderar con este comando.", message.message_id);
          return NextResponse.json({ ok: true });
        }

        const targetUserId = replyTo.from.id;
        const targetUserTag = replyTo.from.username ? `@${replyTo.from.username}` : replyTo.from.first_name;

        if (command === "/kick") {
          await fetch(`https://api.telegram.org/bot${token}/banChatMember?chat_id=${GROUP_CHAT_ID}&user_id=${targetUserId}`);
          await fetch(`https://api.telegram.org/bot${token}/unbanChatMember?chat_id=${GROUP_CHAT_ID}&user_id=${targetUserId}`);
          await sendTelegramMessage(token, chatId, `🚨 *${targetUserTag}* fue expulsado/a del grupo.`, message.message_id);
        } else if (command === "/mute") {
          await fetch(`https://api.telegram.org/bot${token}/restrictChatMember`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: GROUP_CHAT_ID,
              user_id: targetUserId,
              permissions: { can_send_messages: false },
              until_date: Math.floor(Date.now() / 1000) + 24 * 60 * 60
            })
          });
          await sendTelegramMessage(token, chatId, `🔇 *${targetUserTag}* fue silenciado/a por 24 horas.`, message.message_id);
        }
        return NextResponse.json({ ok: true });
      }

      // Comando /codigo ejecutado en el grupo público
      if (command === "/codigo" && chatId.toString() === GROUP_CHAT_ID) {
        // Borrar el mensaje público para proteger la privacidad
        try {
          await fetch(`https://api.telegram.org/bot${token}/deleteMessage?chat_id=${GROUP_CHAT_ID}&message_id=${message.message_id}`);
        } catch {}

        // Intentar enviar el código por privado
        const codeToday = await getDailyTelegramCode(arg || "tu_usuario", 0);
        const privateText = `🔑 *MangaStoon Pase Premium Gratis* 🔑\n\n` +
          `👤 Usuario: *${arg || "usuario"}*\n` +
          `🔑 Código único de hoy:\n` +
          `👉 \`${codeToday}\` 👈\n\n` +
          `*¿Cómo usarlo?*\n` +
          `1. Entrá a tu perfil en MangaStoon.\n` +
          `2. Hacé clic en *Reclamar Pase Gratis*.\n` +
          `3. Pegá este código y ¡listo!`;

        const sentPrivate = await sendTelegramMessage(token, senderId, privateText);

        if (sentPrivate) {
          const publicNotice = `🔒 *@${message.from.username || message.from.first_name}*, por seguridad te mandé tu código diario por chat privado. ¡Revisá tus mensajes directos!`;
          await sendTelegramMessage(token, chatId, publicNotice);
        } else {
          const publicError = `⚠️ *@${message.from.username || message.from.first_name}*, no te pude mandar el código por privado.\n\n` +
            `Hacé clic acá 👉 [Iniciar Chat Privado con el Bot](https://t.me/RaphaelPremiumBot?start=codigo) para activarlo y escribí el comando ahí.`;
          await sendTelegramMessage(token, chatId, publicError);
        }
        return NextResponse.json({ ok: true });
      }

      // Comandos ejecutados en privado
      if (message.chat.type === "private") {
        if (command === "/start") {
          const startText = `👑 *¡Hola ${message.from.first_name || "MangaLector"}!* Soy el bot oficial de MangaStoon.\n\n` +
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
              `_(Reemplazá \`TU_USUARIO\` con tu usuario real de MangaStoon)_`;

            await sendTelegramMessage(token, chatId, missingArgText, message.message_id);
            return NextResponse.json({ ok: true });
          }

          // Verificar si es miembro del grupo
          const isMember = await checkGroupMembership(token, senderId);
          if (!isMember) {
            const notMemberText = `⚠️ *Acceso Denegado.*\n\n` +
              `Para poder obtener tu Pase Premium Gratis, tenés que formar parte de nuestro grupo oficial.\n\n` +
              `👉 [Unite al Grupo de Telegram](https://t.me/+dtPKjcBfiDUyOWQx)\n\n` +
              `¡Una vez que te unas, volvé acá y escribí de nuevo \`/codigo ${arg}\`!`;

            await sendTelegramMessage(token, chatId, notMemberText, message.message_id);
            return NextResponse.json({ ok: true });
          }

          // Rate limit diario en Telegram (máximo 3 consultas)
          const todayStr = new Date().toISOString().split("T")[0];
          const limitInfo = telegramRequestLimitMap.get(senderId);
          if (limitInfo && limitInfo.date === todayStr && limitInfo.count >= 3) {
            await sendTelegramMessage(token, chatId, `🚫 *Límite diario alcanzado.*\n\nYa solicitaste tus códigos de regalo por hoy. Volvé mañana para pedir uno nuevo.`);
            return NextResponse.json({ ok: true });
          }

          // Generar código único para ese usuario
          const codeToday = await getDailyTelegramCode(arg, 0);
          const currentCount = limitInfo && limitInfo.date === todayStr ? limitInfo.count + 1 : 1;
          telegramRequestLimitMap.set(senderId, { count: currentCount, date: todayStr });

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
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("[Telegram Webhook] Error processing update:", error);
    return NextResponse.json({ error: "Internal Server Error", details: error.message }, { status: 500 });
  }
}
