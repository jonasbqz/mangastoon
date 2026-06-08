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
      .select("id, username, avatar_url, username_updated_at, updated_at, reading_direction, is_premium, created_at")
      .eq("id", user.id)
      .maybeSingle();

    // Si no tiene fila en la tabla profiles (por ejemplo, porque se registró antes del trigger)
    // la creamos automáticamente con sus metadatos de auth
    if (!profile) {
      const fallbackUsername = user.user_metadata?.username || user.email?.split("@")[0] || "Usuario";
      const fallbackAvatar = user.user_metadata?.avatar_url || user.user_metadata?.picture || null;

      const { data: newProfile, error: insertError } = await supabase
        .from("profiles")
        .insert({
          id: user.id,
          username: fallbackUsername,
          avatar_url: fallbackAvatar,
          updated_at: new Date().toISOString(),
        })
        .select("id, username, avatar_url, username_updated_at, updated_at, reading_direction, is_premium, created_at")
        .maybeSingle();

      if (!insertError && newProfile) {
        profile = newProfile;
      } else {
        console.error("[getProfile] failed to auto-create profile:", insertError);
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

  // Verificar bloqueo de 7 días
  const { data: profile } = await supabase
    .from("profiles")
    .select("username, username_updated_at")
    .eq("id", user.id)
    .single();

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
export async function getDailyTelegramCode(username: string, offsetDays = 0) {
  const date = new Date();
  if (offsetDays !== 0) {
    date.setDate(date.getDate() + offsetDays);
  }
  const dateString = date.toISOString().split("T")[0]; // YYYY-MM-DD
  const salt = process.env.TELEGRAM_PREMIUM_SALT || "mangastoon_secreto_salt_2026";
  const normalizedUsername = username.trim().toLowerCase();
  const hash = crypto.createHash("md5").update(normalizedUsername + dateString + salt).digest("hex");
  return `MST-${hash.substring(0, 5).toUpperCase()}`;
}

// ─── Activar cuenta Premium ──────────────────────────────────────────────
export async function upgradeToPremiumAction(type: "gifted" | "paid" = "paid", code?: string) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "No autorizado." };
  }

  // Validación de código diario de Telegram para el Pase de Regalo
  if (type === "gifted") {
    if (!code) {
      return { error: "Código de activación requerido. Pedile tu código al bot de Telegram usando tu nombre de usuario." };
    }

    // Obtener perfil para sacar el username
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .single();

    if (profileErr || !profile || !profile.username) {
      return { error: "Configurá un nombre de usuario en tu perfil antes de reclamar el Pase Premium Gratis." };
    }

    const username = profile.username;
    const cleanCode = code.trim().toUpperCase();
    const codeToday = await getDailyTelegramCode(username, 0);
    const codeYesterday = await getDailyTelegramCode(username, -1);
    const codeTomorrow = await getDailyTelegramCode(username, 1);

    if (cleanCode !== codeToday && cleanCode !== codeYesterday && cleanCode !== codeTomorrow) {
      return { error: "Código incorrecto o expirado. Verificá que le hayas mandado tu usuario de MangaStoon exacto al bot." };
    }
  }

  const updateData: any = {
    id: user.id,
    is_premium: true,
    updated_at: new Date().toISOString(),
  };

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

