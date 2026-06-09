"use server";

import { createClient } from "../../utils/supabase/server";
import { revalidatePath } from "next/cache";
import crypto from "crypto";

// ─── Obtener perfil del usuario autenticado ────────────────────────────────
export async function getProfile() {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return null;

    let { data: profile } = await supabase
      .from("profiles")
      .select("id, username, avatar_url, username_updated_at, updated_at, reading_direction, is_premium, created_at, telegram_id, premium_until, telegram_last_checked, telegram_grace_started, premium_type")
      .eq("id", user.id)
      .maybeSingle();

    // Si no tiene fila en la tabla profiles (por ejemplo, porque se registró antes del trigger)
    // la creamos automáticamente con sus metadatos de auth
    if (!profile) {
      const fallbackUsername = user.user_metadata?.username || user.email?.split("@")[0] || "Usuario";
      const fallbackAvatar = user.user_metadata?.picture || null;

      const { data: newProfile, error: insertError } = await supabase
        .from("profiles")
        .insert({
          id: user.id,
          username: fallbackUsername,
          avatar_url: fallbackAvatar,
          updated_at: new Date().toISOString(),
        })
        .select("id, username, avatar_url, username_updated_at, updated_at, reading_direction, is_premium, created_at, telegram_id, premium_until, telegram_last_checked, telegram_grace_started, premium_type")
        .maybeSingle();

      if (!insertError && newProfile) {
        profile = newProfile;
      } else {
        console.error("[getProfile] failed to auto-create profile:", insertError);
      }
    }

    // Validación perezosa (Lazy Validation) para usuarios premium de regalo
    if (profile && profile.is_premium && profile.premium_type === "gifted") {
      const now = new Date();

      // 1. Verificar si ya expiró el período de 30 días
      if (profile.premium_until && new Date(profile.premium_until) < now) {
        console.log(`[getProfile] El premium de regalo de ${profile.username} ha expirado.`);
        const { error: updateErr } = await supabase
          .from("profiles")
          .update({
            is_premium: false,
            premium_until: null,
            telegram_grace_started: null,
            updated_at: new Date().toISOString()
          })
          .eq("id", user.id);

        if (!updateErr) {
          profile.is_premium = false;
          profile.premium_until = null;
          profile.telegram_grace_started = null;
        }
      }
      // 2. Si sigue siendo premium, chequear membresía de Telegram si pasaron más de 24 horas desde la última revisión
      else if (profile.telegram_id) {
        const lastChecked = profile.telegram_last_checked ? new Date(profile.telegram_last_checked) : null;
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        if (!lastChecked || lastChecked < oneDayAgo) {
          const token = process.env.TELEGRAM_BOT_TOKEN;
          const channelId = process.env.TELEGRAM_CHANNEL_ID || "-1003763338725";
          
          let isMember = false;
          if (token) {
            try {
              const res = await fetch(`https://api.telegram.org/bot${token}/getChatMember?chat_id=${channelId}&user_id=${profile.telegram_id}`);
              const data = await res.json();
              if (res.ok && data.ok) {
                const status = data.result?.status;
                isMember = ["member", "administrator", "creator", "restricted"].includes(status);
              }
            } catch (err) {
              console.warn("[getProfile] Error consultando membresía en Telegram, asumiendo miembro temporalmente:", err);
              isMember = true;
            }
          } else {
            isMember = true;
          }

          if (isMember) {
            // Sigue en el grupo, actualizar fecha de chequeo y limpiar gracia (si estaba en gracia)
            const { error: updateErr } = await supabase
              .from("profiles")
              .update({
                telegram_last_checked: new Date().toISOString(),
                telegram_grace_started: null,
                updated_at: new Date().toISOString()
              })
              .eq("id", user.id);

            if (!updateErr) {
              profile.telegram_last_checked = new Date().toISOString();
              profile.telegram_grace_started = null;
            }
          } else {
            // Ya no está en el grupo
            if (!profile.telegram_grace_started) {
              // Iniciar período de gracia de 24 horas
              const graceStart = new Date().toISOString();
              const { error: updateErr } = await supabase
                .from("profiles")
                .update({
                  telegram_last_checked: new Date().toISOString(),
                  telegram_grace_started: graceStart,
                  updated_at: new Date().toISOString()
                })
                .eq("id", user.id);

              if (!updateErr) {
                profile.telegram_last_checked = new Date().toISOString();
                profile.telegram_grace_started = graceStart;
              }
            } else {
              // Ya estaba en gracia, ver si ya pasaron las 24 horas
              const graceStart = new Date(profile.telegram_grace_started);
              const graceExpiration = new Date(graceStart.getTime() + 24 * 60 * 60 * 1000);

              if (now > graceExpiration) {
                // Período de gracia expiró! Revocar premium.
                console.log(`[getProfile] Período de gracia de 24h expiró para ${profile.username}. Revocando premium.`);
                const { error: updateErr } = await supabase
                  .from("profiles")
                  .update({
                    is_premium: false,
                    premium_until: null,
                    telegram_grace_started: null,
                    updated_at: new Date().toISOString()
                  })
                  .eq("id", user.id);

                if (!updateErr) {
                  profile.is_premium = false;
                  profile.premium_until = null;
                  profile.telegram_grace_started = null;
                }
              }
            }
          }
        }
      }
    }

    // Restaurar premium_since en metadatos de auth si es premium pero Discord/OAuth lo borró
    if (profile && profile.is_premium && !user.user_metadata?.premium_since) {
      const defaultPremiumSince = profile.created_at || user.created_at || new Date().toISOString();
      try {
        await supabase.auth.updateUser({
          data: {
            premium_since: defaultPremiumSince
          }
        });
        if (!user.user_metadata) user.user_metadata = {};
        user.user_metadata.premium_since = defaultPremiumSince;
      } catch (e) {
        console.warn("[getProfile] failed to restore premium_since metadata:", e);
      }
    }

    return { user, profile: profile ?? null };
  } catch (err) {
    console.error("[getProfile] Error loading profile:", err);
    return null;
  }
}

// ─── Actualizar nombre de usuario (con bloqueo de 7 días) ─────────────────
export async function updateUsername(newUsername: string) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "No autorizado." };
  }

  const trimmed = newUsername.trim();

  if (!trimmed || trimmed.length < 3) {
    return { error: "El nombre de usuario debe tener al menos 3 caracteres." };
  }
  if (trimmed.length > 30) {
    return { error: "El nombre de usuario no puede superar los 30 caracteres." };
  }
  if (!/^[a-zA-Z0-9_.-]+$/.test(trimmed)) {
    return { error: "Solo se permiten letras, números, puntos, guiones y guiones bajos." };
  }

  // Verificar bloqueo de 7 días y estado de administrador
  const { data: profile } = await supabase
    .from("profiles")
    .select("username, username_updated_at, is_admin")
    .eq("id", user.id)
    .single();

  const lowerUsername = trimmed.toLowerCase();
  const reservedWords = ["mangastoon", "admin", "owner", "staff", "moderador", "moderator", "soporte", "support", "system", "dueño", "dueno"];
  const hasReservedWord = reservedWords.some((word) => lowerUsername.includes(word));

  if (hasReservedWord && !profile?.is_admin) {
    return { error: "El nombre de usuario contiene términos reservados para el equipo oficial." };
  }

  if (profile?.username && profile?.username_updated_at) {
    const lastUpdate = new Date(profile.username_updated_at);
    const daysSince = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSince < 7) {
      const daysLeft = Math.ceil(7 - daysSince);
      return {
        error: `Solo puedes cambiar tu nombre de usuario una vez cada 7 días. Puedes volver a cambiarlo en ${daysLeft} día${daysLeft === 1 ? "" : "s"}.`,
      };
    }
  }

  const { error } = await supabase.from("profiles").upsert({
    id: user.id,
    username: trimmed,
    username_updated_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  if (error) {
    console.error("[updateUsername] DB error:", error.code, error.message, error.details);
    return { error: `Error al guardar: ${error.message} (code: ${error.code})` };
  }

  revalidatePath("/profile");
  return { success: true };
}

// ─── Upsert de perfil desde OAuth (Discord, etc.) ─────────────────────────
// Llamado desde el callback de autenticación
export async function upsertOAuthProfile(userId: string, discordUsername: string, avatarUrl?: string) {
  const supabase = await createClient();

  // Solo escribir username si el perfil aún no tiene uno
  const { data: existing } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", userId)
    .single();

  if (existing?.username) return; // ya tiene username, no sobreescribir

  await supabase.from("profiles").upsert({
    id: userId,
    username: discordUsername,
    avatar_url: avatarUrl ?? null,
    updated_at: new Date().toISOString(),
    // username_updated_at NO se setea en el primer ingreso para no bloquear el cambio inicial
  });
}

// ─── Subida de avatar ─────────────────────────────────────────────────────
// Path fijo: avatars/{userId}/avatar — siempre sobrescribe el mismo archivo.
// upsert: true evita archivos huérfanos sin importar el tipo de imagen anterior.
const ALLOWED_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg":  "jpg",
  "image/png":  "png",
  "image/webp": "webp",
};
const MAX_BYTES = 1_048_576; // 1 MB

export async function uploadAvatar(formData: FormData) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "No autorizado." };
  }

  const file = formData.get("avatar") as File | null;

  if (!file || file.size === 0) {
    return { error: "No se seleccionó ningún archivo." };
  }

  // ── Validación de tipo ──────────────────────────────────────────────────
  if (!ALLOWED_MIME[file.type]) {
    return { error: "Solo se permiten imágenes .jpg, .jpeg, .png o .webp." };
  }

  // ── Validación de tamaño (doble capa: cliente ya validó, servidor confirma) ─
  if (file.size > MAX_BYTES) {
    return { error: "La imagen es demasiado pesada. El tamaño máximo permitido es de 1 MB." };
  }

  // ── Path fijo: mismo archivo siempre, upsert lo sobrescribe ────────────
  // Usamos el userId como carpeta + "avatar" como nombre fijo.
  // Nunca quedan archivos huérfanos: siempre es la misma ruta.
  const storagePath = `${user.id}/avatar`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(storagePath, file, {
      upsert: true,            // sobreescribe si ya existe
      contentType: file.type,  // sirve con el MIME correcto
      cacheControl: "3600",
    });

  if (uploadError) {
    console.error("[uploadAvatar] storage error:", uploadError.message, uploadError);
    return { error: `Error de Storage: ${uploadError.message}` };
  }

  // ── URL pública + cache-bust para que el navegador no muestre la foto vieja ─
  const { data: { publicUrl } } = supabase.storage
    .from("avatars")
    .getPublicUrl(storagePath);

  const bustUrl = `${publicUrl}?t=${Date.now()}`;

  // ── Actualizar perfil ────────────────────────────────────────────────────
  const { error: profileError } = await supabase.from("profiles").upsert({
    id: user.id,
    avatar_url: bustUrl,
    updated_at: new Date().toISOString(),
  });

  if (profileError) {
    console.error("[uploadAvatar] profile update error:", profileError.code, profileError.message);
    return { error: `Imagen subida, pero no se pudo actualizar el perfil: ${profileError.message}` };
  }

  revalidatePath("/profile");
  return { success: true, url: bustUrl };
}

// ─── Actualizar dirección de lectura ──────────────────────────────────────
export async function updateReadingDirection(direction: "vertical" | "horizontal") {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "No autorizado." };
  }

  const { error } = await supabase.from("profiles").upsert({
    id: user.id,
    reading_direction: direction,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    console.error("[updateReadingDirection] DB error:", error.code, error.message);
    return { error: `Error al guardar preferencia: ${error.message}` };
  }

  revalidatePath("/profile");
  return { success: true };
}

// ─── Programar eliminación de cuenta (período de gracia de 30 días) ───────────
export async function deleteAccountAction() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "No autorizado." };
  }

  const targetDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  // Guardar fecha de eliminación en los metadatos de auth del usuario
  const { error } = await supabase.auth.updateUser({
    data: {
      scheduled_delete_at: targetDate
    }
  });

  if (error) {
    console.error("[deleteAccountAction] error updating user metadata:", error.message);
    return { error: `Error al programar la eliminación: ${error.message}` };
  }

  revalidatePath("/profile");
  return { success: true, targetDate };
}

// ─── Generación de código diario de Telegram ──────────────────────────────
export async function getDailyTelegramCode(username: string, offsetDays = 0, telegramId?: number) {
  const date = new Date();
  if (offsetDays !== 0) {
    date.setDate(date.getDate() + offsetDays);
  }
  const dateString = date.toISOString().split("T")[0]; // YYYY-MM-DD
  const salt = process.env.TELEGRAM_PREMIUM_SALT || "mangastoon_secreto_salt_2026";
  const normalizedUsername = username.trim().toLowerCase();
  
  const tid = telegramId !== undefined ? telegramId : 0;
  const hash = crypto.createHash("md5").update(normalizedUsername + tid + dateString + salt).digest("hex");
  
  if (telegramId !== undefined) {
    return `MST-${tid}-${hash.substring(0, 5).toUpperCase()}`;
  }
  return `MST-${hash.substring(0, 5).toUpperCase()}`;
}

const failedAttemptsMap = new Map<string, { count: number; blockedUntil: number }>();

// ─── Activar cuenta Premium ──────────────────────────────────────────────
export async function upgradeToPremiumAction(type: "gifted" | "paid" = "paid", code?: string) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "No autorizado." };
  }

  let verifiedTelegramId: number | null = null;

  // Validación de código de Telegram para el Pase de Regalo (1 mes)
  if (type === "gifted") {
    const userId = user.id;

    // Verificar si el usuario está bloqueado por rate limit
    const attemptInfo = failedAttemptsMap.get(userId);
    if (attemptInfo && attemptInfo.blockedUntil > Date.now()) {
      const minutesLeft = Math.ceil((attemptInfo.blockedUntil - Date.now()) / 60000);
      return { error: `Demasiados intentos fallidos. Reintenta en ${minutesLeft} minutos.` };
    }

    if (!code) {
      return { error: "Código de activación requerido. Pídele tu código al bot de Telegram usando tu nombre de usuario." };
    }

    // Obtener perfil para sacar el username
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .single();

    if (profileErr || !profile || !profile.username) {
      return { error: "Configura un nombre de usuario en tu perfil antes de reclamar el Pase Premium Gratis." };
    }

    const username = profile.username;
    const cleanCode = code.trim().toUpperCase();

    // Parsear código MST-{telegramId}-{hash}
    const parts = cleanCode.split("-");
    if (parts.length !== 3 || parts[0] !== "MST") {
      return { error: "Código inválido o formato incorrecto." };
    }

    const telegramIdStr = parts[1];
    const receivedHash = parts[2];
    const telegramId = parseInt(telegramIdStr, 10);

    if (isNaN(telegramId)) {
      return { error: "Código inválido. ID de Telegram incorrecto." };
    }

    const codeToday = await getDailyTelegramCode(username, 0, telegramId);
    const codeYesterday = await getDailyTelegramCode(username, -1, telegramId);
    const codeTomorrow = await getDailyTelegramCode(username, 1, telegramId);

    if (cleanCode !== codeToday && cleanCode !== codeYesterday && cleanCode !== codeTomorrow) {
      // Incrementar contador de intentos fallidos
      const currentAttempts = attemptInfo ? attemptInfo.count + 1 : 1;
      if (currentAttempts >= 5) {
        failedAttemptsMap.set(userId, {
          count: currentAttempts,
          blockedUntil: Date.now() + 15 * 60 * 1000 // 15 minutos de bloqueo
        });
        return { error: "Código incorrecto. Tu cuenta fue bloqueada temporalmente por 15 minutos debido a demasiados intentos fallidos." };
      } else {
        failedAttemptsMap.set(userId, {
          count: currentAttempts,
          blockedUntil: 0
        });
        const remaining = 5 - currentAttempts;
        return { error: `Código incorrecto. Te quedan ${remaining} intentos antes del bloqueo de seguridad.` };
      }
    }

    // Código correcto
    verifiedTelegramId = telegramId;
    failedAttemptsMap.delete(userId);
  }

  const premiumUntilDate = type === "gifted" 
    ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 días
    : null;

  const updateData: any = {
    id: user.id,
    is_premium: true,
    updated_at: new Date().toISOString(),
    premium_until: premiumUntilDate,
    telegram_last_checked: type === "gifted" ? new Date().toISOString() : null,
    telegram_grace_started: null,
  };

  if (verifiedTelegramId !== null) {
    updateData.telegram_id = verifiedTelegramId;
  }

  // Guardar premium_since en los metadatos de auth del usuario para persistir la fecha original si no existe ya
  const existingPremiumSince = user.user_metadata?.premium_since;
  if (!existingPremiumSince) {
    const { error: authMetaError } = await supabase.auth.updateUser({
      data: {
        premium_since: new Date().toISOString()
      }
    });

    if (authMetaError) {
      console.warn("[upgradeToPremiumAction] failed to update auth metadata:", authMetaError.message);
    }
  }

  // Intentamos guardar con premium_type primero
  const { error } = await supabase.from("profiles").upsert({
    ...updateData,
    premium_type: type,
  });

  if (error) {
    // Si la columna premium_type no existe en la BD, hacemos fallback al guardado simple
    if (error.message?.includes("column") && error.message?.includes("does not exist")) {
      console.warn("[upgradeToPremiumAction] La columna 'premium_type' no existe en la tabla profiles. Haciendo fallback al modo simple (is_premium: true). ¡Por favor ejecuta el script de migración SQL en Supabase!");
      const { error: fallbackError } = await supabase.from("profiles").upsert(updateData);
      if (fallbackError) {
        console.error("[upgradeToPremiumAction] Fallback DB error:", fallbackError.code, fallbackError.message);
        return { error: `Error al activar Premium: ${fallbackError.message}` };
      }
    } else {
      console.error("[upgradeToPremiumAction] DB error:", error.code, error.message);
      return { error: `Error al activar Premium: ${error.message}` };
    }
  }

  revalidatePath("/profile");
  return { success: true };
}

