"use server";

import { createClient } from "../../utils/supabase/server";

export async function getHistoryAction() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "unauthenticated" };
  }

  const { data, error } = await supabase
    .from("reading_history")
    .select("manga_id, manga_title, chapter_id, chapter_number, cover_image, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("[getHistoryAction] DB error:", error.code, error.message);
    if (error.code === "P0001" || error.message?.includes("relation") || error.message?.includes("does not exist")) {
      return { error: "table_not_exists", history: [] };
    }
    return { error: "db_error", message: error.message, history: [] };
  }

  const history = (data || []).map((item) => ({
    mangaId: item.manga_id,
    mangaTitle: item.manga_title,
    chapterId: item.chapter_id,
    chapterNumber: item.chapter_number,
    coverImage: item.cover_image || "",
    timestamp: new Date(item.updated_at).getTime(),
  }));

  return { history };
}

export async function addHistoryAction(item: {
  mangaId: string;
  mangaTitle: string;
  chapterId: string;
  chapterNumber: string;
  coverImage: string;
}) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "unauthenticated" };
  }

  const { error } = await supabase
    .from("reading_history")
    .upsert({
      user_id: user.id,
      manga_id: item.mangaId,
      manga_title: item.mangaTitle,
      chapter_id: item.chapterId,
      chapter_number: item.chapterNumber,
      cover_image: item.coverImage || null,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: "user_id,manga_id"
    });

  if (error) {
    console.error("[addHistoryAction] DB error:", error.code, error.message);
    return { error: "db_error", message: error.message };
  }

  return { success: true };
}

export async function removeHistoryAction(mangaId: string) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "unauthenticated" };
  }

  const { error } = await supabase
    .from("reading_history")
    .delete()
    .eq("user_id", user.id)
    .eq("manga_id", mangaId);

  if (error) {
    console.error("[removeHistoryAction] DB error:", error.code, error.message);
    return { error: "db_error", message: error.message };
  }

  return { success: true };
}

export async function clearHistoryAction() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "unauthenticated" };
  }

  const { error } = await supabase
    .from("reading_history")
    .delete()
    .eq("user_id", user.id);

  if (error) {
    console.error("[clearHistoryAction] DB error:", error.code, error.message);
    return { error: "db_error", message: error.message };
  }

  return { success: true };
}
