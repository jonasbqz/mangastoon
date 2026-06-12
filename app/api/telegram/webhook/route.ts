import { NextResponse } from "next/server";
import { getDailyTelegramCode } from "../../../actions/profile";
import { createClient } from "../../../../utils/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const GROUP_CHAT_ID = "-1003763338725";
const telegramRequestLimitMap = new Map<number, { count: number; date: string }>();
const userMessageTimeline = new Map<number, number[]>();

async function saveTelegramMessage(data: {
  chat_id: number;
  sender_id?: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  message_text: string;
  is_from_bot: boolean;
}) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://xlcsqqwelopzpslxgdni.supabase.co";
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    let supabase;
    if (serviceRoleKey) {
      supabase = createSupabaseClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false }
      });
    } else {
      supabase = await createClient();
    }

    await supabase.from("telegram_messages").insert({
      chat_id: data.chat_id,
      sender_id: data.sender_id || null,
      username: data.username || null,
      first_name: data.first_name || null,
      last_name: data.last_name || null,
      message_text: data.message_text,
      is_from_bot: data.is_from_bot,
      created_at: new Date().toISOString()
    });
  } catch (err) {
    console.error("[Telegram Webhook] Failed to save telegram message to DB:", err);
  }
}

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

async function sendTelegramMessage(
  token: string, 
  chatId: number, 
  text: string, 
  replyToMessageId?: number, 
  replyMarkup?: any,
  autoDeleteDelayMs?: number
): Promise<boolean> {
  const telegramUrl = `https://api.telegram.org/bot${token}/sendMessage`;
  try {
    // Log the outgoing message from the bot
    await saveTelegramMessage({
      chat_id: chatId,
      message_text: text,
      is_from_bot: true,
      first_name: "Raphael Bot"
    });

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
        reply_markup: replyMarkup
      }),
    });
    const data = await res.json();
    
    // Auto-limpieza en segundo plano si hay un delay especificado
    const messageId = data.result?.message_id;
    if (res.ok && data.ok && autoDeleteDelayMs && messageId) {
      setTimeout(async () => {
        try {
          await fetch(`https://api.telegram.org/bot${token}/deleteMessage?chat_id=${chatId}&message_id=${messageId}`);
        } catch (err) {
          console.warn("[Telegram Webhook] Failed to delete temporary warning:", err);
        }
      }, autoDeleteDelayMs);
    }

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

    // Verificar token secreto para evitar suplantación (spoofing)
    const salt = process.env.TELEGRAM_PREMIUM_SALT || "mangastoon_secreto_salt_2026";
    const expectedSecret = require("crypto").createHash("sha256").update(salt).digest("hex");
    const receivedSecret = req.headers.get("x-telegram-bot-api-secret-token");

    if (receivedSecret !== expectedSecret) {
      console.warn("[Telegram Webhook] Request blocked: Invalid secret token.");
      return new NextResponse("Unauthorized", { status: 401 });
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

    // ─── 1. SEGURIDAD GRUPAL (SOLO EN EL SUPERGRUPO) ──────────────────────────
    if (chatId.toString() === GROUP_CHAT_ID && senderId) {
      const isAdmin = await isUserAdmin(token, senderId);

      if (!isAdmin) {
        // A. Anti-Flood (Spam rápido): > 5 mensajes en 5 segundos
        const now = Date.now();
        const timestamps = userMessageTimeline.get(senderId) || [];
        const activeTimestamps = timestamps.filter(t => now - t < 5000);
        activeTimestamps.push(now);
        userMessageTimeline.set(senderId, activeTimestamps);

        if (activeTimestamps.length > 5) {
          // Silenciar al usuario por 30 minutos (1800 segundos)
          const muteUntil = Math.floor(now / 1000) + 30 * 60;
          await fetch(`https://api.telegram.org/bot${token}/restrictChatMember`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: GROUP_CHAT_ID,
              user_id: senderId,
              permissions: { can_send_messages: false },
              until_date: muteUntil
            })
          });

          // Borrar el mensaje infractor
          await fetch(`https://api.telegram.org/bot${token}/deleteMessage?chat_id=${GROUP_CHAT_ID}&message_id=${message.message_id}`);
          
          await sendTelegramMessage(token, chatId, `🔇 *@${message.from.username || message.from.first_name}* ha sido silenciado/a por *30 minutos* por enviar mensajes demasiado rápido (Anti-Flood).`, undefined, undefined, 30000);
          return NextResponse.json({ ok: true });
        }

        // B. Anti-Malware (Filtro de archivos potencialmente peligrosos)
        if (message.document) {
          const mimeType = message.document.mime_type || "";
          const isAllowed = mimeType.startsWith("image/") || mimeType === "application/pdf";
          if (!isAllowed) {
            await fetch(`https://api.telegram.org/bot${token}/deleteMessage?chat_id=${GROUP_CHAT_ID}&message_id=${message.message_id}`);
            await sendTelegramMessage(token, chatId, `⚠️ *@${message.from.username || message.from.first_name}*, por seguridad de todos, no se permite compartir archivos potencialmente peligrosos (.zip, .exe, etc.).`, undefined, undefined, 30000);
            return NextResponse.json({ ok: true });
          }
        }

        // C. Filtro de Enlaces Externos
        if (text) {
          const hasExternalLink = text.match(/https?:\/\/[^\s]+/i) && 
                                  !text.toLowerCase().includes("mangastoon.com") && 
                                  !text.toLowerCase().includes("t.me");
          if (hasExternalLink) {
            await fetch(`https://api.telegram.org/bot${token}/deleteMessage?chat_id=${GROUP_CHAT_ID}&message_id=${message.message_id}`);
            return NextResponse.json({ ok: true });
          }
        }
      }
    }

    // ─── 2. NUEVOS MIEMBROS EN EL GRUPO ──────────────────────────────────────
    if (message.new_chat_members && message.new_chat_members.length > 0) {
      for (const member of message.new_chat_members) {
        if (member.is_bot) continue;

        const welcomeText = `👋 *¡Hola ${member.first_name || "MangaLector"}!*\n` +
          `Bienvenido/a a la comunidad oficial de *MangaStoon*.\n\n` +
          `🔑 Si estás aquí por tu *Pase Premium Gratis*, puedes solicitar tu código diario de hoy hablando por privado con nuestro bot.`;

        const replyMarkup = {
          inline_keyboard: [
            [
              {
                text: "🎁 Reclamar Pase Premium Gratis",
                url: "https://t.me/RaphaelPremiumBot?start=codigo"
              }
            ],
            [
              {
                text: "🌐 Visitar MangaStoon",
                url: "https://mangastoon.com"
              }
            ]
          ]
        };

        await sendTelegramMessage(token, chatId, welcomeText, message.message_id, replyMarkup);
      }
      return NextResponse.json({ ok: true });
    }

    // ─── 3. COMANDOS DE TELEGRAM ─────────────────────────────────────────────
    if (text.startsWith("/")) {
      const parts = text.split(/\s+/);
      const command = parts[0].toLowerCase();
      const arg = parts.slice(1).join(" ").trim();

      // Comandos de moderación para administradores
      if (command === "/scraper_status" && senderId) {
        const isAdmin = await isUserAdmin(token, senderId);
        if (!isAdmin) {
          await sendTelegramMessage(token, chatId, "⚠️ No tenés permisos de administrador para ejecutar este comando.", message.message_id, undefined, 10000);
          return NextResponse.json({ ok: true });
        }

        try {
          const supabase = await createClient();
          const { data: queueItems, error: queueError } = await supabase
            .from("scraper_queue")
            .select("status");

          if (queueError) {
            await sendTelegramMessage(token, chatId, `❌ Error al consultar la cola del scraper: ${queueError.message}`, message.message_id);
            return NextResponse.json({ ok: true });
          }

          const counts = { pending: 0, processing: 0, completed: 0, failed: 0 };
          (queueItems || []).forEach((item: any) => {
            const status = item.status;
            if (status in counts) {
              counts[status as keyof typeof counts]++;
            }
          });

          const statusText = `📊 *Estado del Scraper* 📊\n\n` +
            `⏳ Pendientes: *${counts.pending}*\n` +
            `⚙️ Procesando: *${counts.processing}*\n` +
            `✅ Completados: *${counts.completed}*\n` +
            `❌ Fallidos: *${counts.failed}*`;

          await sendTelegramMessage(token, chatId, statusText, message.message_id);
        } catch (err: any) {
          await sendTelegramMessage(token, chatId, `❌ Error del servidor: ${err.message}`, message.message_id);
        }
        return NextResponse.json({ ok: true });
      }

      if (command === "/prioritize" && senderId) {
        const isAdmin = await isUserAdmin(token, senderId);
        if (!isAdmin) {
          await sendTelegramMessage(token, chatId, "⚠️ No tenés permisos de administrador para ejecutar este comando.", message.message_id, undefined, 10000);
          return NextResponse.json({ ok: true });
        }

        if (!arg) {
          await sendTelegramMessage(token, chatId, "⚠️ Por favor, especificá la URL del manga a priorizar.\n\nEjemplo: `/prioritize https://leercapitulo.com/manga/solo-leveling`", message.message_id);
          return NextResponse.json({ ok: true });
        }

        if (!arg.startsWith("http://") && !arg.startsWith("https://")) {
          await sendTelegramMessage(token, chatId, "⚠️ La URL provista no es válida. Debe comenzar con http:// o https://", message.message_id);
          return NextResponse.json({ ok: true });
        }

        try {
          const supabase = await createClient();
          
          let mangaTitle = "Manga Encolado via Telegram";
          try {
            const url = new URL(arg);
            const pathParts = url.pathname.split("/").filter(Boolean);
            if (pathParts.length > 0) {
              const lastPart = pathParts[pathParts.length - 1];
              mangaTitle = lastPart
                .replace(/[-_]/g, " ")
                .replace(/\b\w/g, c => c.toUpperCase());
            }
          } catch {}

          const { error: insertErr } = await supabase
            .from("scraper_queue")
            .upsert({
              manga_title: mangaTitle,
              source_url: arg,
              status: "pending",
              priority: 10,
              updated_at: new Date().toISOString()
            }, { onConflict: "source_url" });

          if (insertErr) {
            await sendTelegramMessage(token, chatId, `❌ Error al encolar en la base de datos: ${insertErr.message}`, message.message_id);
          } else {
            const escapedTitle = mangaTitle.replace(/_/g, "\\_").replace(/\*/g, "\\*");
            const escapedUrl = arg.replace(/_/g, "\\_").replace(/\*/g, "\\*");
            await sendTelegramMessage(token, chatId, `✅ ¡Manga priorizado con éxito!\n\n📖 Título: *${escapedTitle}*\n🔗 URL: ${escapedUrl}\n⚡ Prioridad asignada: *10*`, message.message_id);
          }
        } catch (err: any) {
          await sendTelegramMessage(token, chatId, `❌ Error del servidor: ${err.message}`, message.message_id);
        }
        return NextResponse.json({ ok: true });
      }

      // Comandos de moderación para administradores (kick/mute)
      if ((command === "/kick" || command === "/mute") && chatId.toString() === GROUP_CHAT_ID && senderId) {
        const isAdmin = await isUserAdmin(token, senderId);
        if (!isAdmin) return NextResponse.json({ ok: true });

        const replyTo = message.reply_to_message;
        if (!replyTo) {
          await sendTelegramMessage(token, chatId, "⚠️ Responde al mensaje del usuario que deseas moderar con este comando.", message.message_id, undefined, 30000);
          return NextResponse.json({ ok: true });
        }

        const targetUserId = replyTo.from.id;
        const targetUserTag = replyTo.from.username ? `@${replyTo.from.username}` : replyTo.from.first_name;

        if (command === "/kick") {
          await fetch(`https://api.telegram.org/bot${token}/banChatMember?chat_id=${GROUP_CHAT_ID}&user_id=${targetUserId}`);
          await fetch(`https://api.telegram.org/bot${token}/unbanChatMember?chat_id=${GROUP_CHAT_ID}&user_id=${targetUserId}`);
          await sendTelegramMessage(token, chatId, `🚨 *${targetUserTag}* ha sido expulsado/a del grupo.`, message.message_id);
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
          await sendTelegramMessage(token, chatId, `🔇 *${targetUserTag}* ha sido silenciado/a por 24 horas.`, message.message_id);
        }
        return NextResponse.json({ ok: true });
      }

      // Comando /codigo ejecutado en el grupo público
      if (command === "/codigo" && chatId.toString() === GROUP_CHAT_ID && senderId) {
        // Borrar el mensaje público para proteger la privacidad
        try {
          await fetch(`https://api.telegram.org/bot${token}/deleteMessage?chat_id=${GROUP_CHAT_ID}&message_id=${message.message_id}`);
        } catch {}

        // Interceptar si el remitente es el GroupAnonymousBot
        if (senderId === 1087968824 || message.from?.username === "GroupAnonymousBot") {
          const publicError = `⚠️ *Estimado Administrador Anónimo*:\n\n` +
            `No es posible enviar mensajes privados a cuentas anónimas o al sistema del grupo.\n\n` +
            `Por favor, realiza la solicitud desde tu cuenta personal de Telegram.`;
          await sendTelegramMessage(token, chatId, publicError, undefined, undefined, 30000);
          return NextResponse.json({ ok: true });
        }

        // Intentar enviar el código por privado
        const codeToday = await getDailyTelegramCode(arg || "tu_usuario", 0, senderId);
        const privateText = `🔑 *MangaStoon Pase Premium Gratis (1 Mes)* 🔑\n\n` +
          `👤 Usuario: *${arg || "usuario"}*\n` +
          `🔑 Código único de hoy:\n` +
          `👉 \`${codeToday}\` 👈\n\n` +
          `*¿Cómo usarlo?*\n` +
          `1. Ingresa a tu perfil en MangaStoon.\n` +
          `2. Haz clic en *Reclamar Pase Gratis*.\n` +
          `3. Pega este código y ¡listo! Disfruta de 30 días de premium gratis.`;

        const sentPrivate = await sendTelegramMessage(token, senderId, privateText);

        if (sentPrivate) {
          const publicNotice = `🔒 *@${message.from.username || message.from.first_name}*, por seguridad te he enviado tu código diario por chat privado. ¡Revisa tus mensajes directos!`;
          await sendTelegramMessage(token, chatId, publicNotice, undefined, undefined, 30000);
        } else {
          const publicError = `⚠️ *@${message.from.username || message.from.first_name}*, no he podido enviarte el código por privado.\n\n` +
            `Haz clic aquí 👉 [Iniciar Chat Privado con el Bot](https://t.me/RaphaelPremiumBot?start=codigo) para activarlo y escribe el comando allí.`;
          await sendTelegramMessage(token, chatId, publicError, undefined, undefined, 60000);
        }
        return NextResponse.json({ ok: true });
      }

      // Comandos ejecutados en privado
      if (message.chat.type === "private" && senderId) {
        if (command === "/start") {
          const startText = `👑 *¡Hola ${message.from.first_name || "MangaLector"}!* Soy el bot oficial de MangaStoon.\n\n` +
            `Para conseguir tu código diario único de premium gratis, usa el comando:\n` +
            `👉 \`/codigo TU_USUARIO\`\n\n` +
            `_(Ejemplo: \`/codigo Juan123\`. Puedes ver tu nombre de usuario en tu perfil de MangaStoon)_`;

          await sendTelegramMessage(token, chatId, startText, message.message_id);
          return NextResponse.json({ ok: true });
        }

        if (command === "/codigo") {
          if (!arg) {
            const missingArgText = `⚠️ *Falta tu nombre de usuario.*\n\n` +
              `Por favor, ingresa el comando de esta forma:\n` +
              `👉 \`/codigo TU_USUARIO\`\n\n` +
              `_(Reemplaza \`TU_USUARIO\` con tu usuario real de MangaStoon)_`;

            await sendTelegramMessage(token, chatId, missingArgText, message.message_id);
            return NextResponse.json({ ok: true });
          }

          // Verificar si es miembro del grupo
          const isMember = await checkGroupMembership(token, senderId);
          if (!isMember) {
            const notMemberText = `⚠️ *Acceso Denegado.*\n\n` +
              `Para poder obtener tu Pase Premium Gratis, debes formar parte de nuestro grupo oficial.\n\n` +
              `👉 [Únete al Grupo de Telegram](https://t.me/+dtPKjcBfiDUyOWQx)\n\n` +
              `¡Una vez que te unas, regresa aquí y escribe de nuevo \`/codigo ${arg}\`!`;

            await sendTelegramMessage(token, chatId, notMemberText, message.message_id);
            return NextResponse.json({ ok: true });
          }

          // Rate limit diario en Telegram (máximo 3 consultas)
          const todayStr = new Date().toISOString().split("T")[0];
          const limitInfo = telegramRequestLimitMap.get(senderId);
          if (limitInfo && limitInfo.date === todayStr && limitInfo.count >= 3) {
            await sendTelegramMessage(token, chatId, `🚫 *Límite diario alcanzado.*\n\nYa has solicitado tus códigos de regalo por hoy. Regresa mañana para pedir uno nuevo.`);
            return NextResponse.json({ ok: true });
          }

          // Generar código único para ese usuario
          const codeToday = await getDailyTelegramCode(arg, 0, senderId);
          const currentCount = limitInfo && limitInfo.date === todayStr ? limitInfo.count + 1 : 1;
          telegramRequestLimitMap.set(senderId, { count: currentCount, date: todayStr });

          const codeText = `🔑 *MangaStoon Pase Premium Gratis (1 Mes)* 🔑\n\n` +
            `👤 Usuario: *${arg}*\n` +
            `🔑 Código único de hoy:\n` +
            `👉 \`${codeToday}\` 👈\n\n` +
            `*¿Cómo usarlo?*\n` +
            `1. Ingresa a tu perfil en MangaStoon.\n` +
            `2. Haz clic en *Reclamar Pase Gratis*.\n` +
            `3. Pega este código y ¡listo! Disfruta de todos los beneficios premium por 30 días gratis.\n\n` +
            `_(Este código es exclusivo para la cuenta *${arg}*. Si colocas otro usuario en la web, el código no funcionará)_`;

          await sendTelegramMessage(token, chatId, codeText, message.message_id);
          return NextResponse.json({ ok: true });
        }

        // Fallback para cualquier otro mensaje o pregunta en privado
        const fallbackText = `🤖 *Centro de Ayuda de MangaStoon* 🤖\n\n` +
          `Para reclamar tu **Pase Premium Gratis**, recuerda usar el comando:\n` +
          `👉 \`/codigo TU_USUARIO\`\n` +
          `_(Ejemplo: \`/codigo Juan123\` - encuentras tu usuario en tu perfil de la web)_\n\n` +
          `⚠️ *Errores comunes y soluciones:*\n` +
          `• **"Código incorrecto"**: Asegúrate de haber escrito tu nombre de usuario exactamente igual a como aparece en tu perfil de MangaStoon (respetando mayúsculas, minúsculas, puntos y guiones).\n` +
          `• **"Debes formar parte del grupo oficial"**: Es obligatorio unirse a nuestro grupo antes de pedir el código. [Únete aquí](https://t.me/+dtPKjcBfiDUyOWQx).\n` +
          `• **"Límite diario alcanzado"**: Solo puedes solicitar tus códigos hasta 3 veces al día. Si ya activaste tu pase, tendrás 30 días de premium gratis.\n\n` +
          `💬 *¿Tienes dudas o preguntas?*\n` +
          `Por seguridad y para darte una mejor atención, por favor **haz tu pregunta en nuestro grupo oficial de Telegram**. Allí, los administradores de la página te brindarán ayuda lo antes posible.\n` +
          `👉 [Ir al Grupo Oficial de MangaStoon](https://t.me/+dtPKjcBfiDUyOWQx)`;

        await sendTelegramMessage(token, chatId, fallbackText, message.message_id);
        return NextResponse.json({ ok: true });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("[Telegram Webhook] Error processing update:", error);
    return NextResponse.json({ error: "Internal Server Error", details: error.message }, { status: 500 });
  }
}

