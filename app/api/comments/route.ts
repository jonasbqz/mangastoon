import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { createClient } from "../../../utils/supabase/server";

export const dynamic = "force-dynamic";

const commentsFilePath = path.join(process.cwd(), ".next", "comments.json");

// ── Fallback File System logic ─────────────────────────────────────────────
async function readCommentsFile(): Promise<any[]> {
  try {
    await fs.mkdir(path.dirname(commentsFilePath), { recursive: true });
    try {
      const data = await fs.readFile(commentsFilePath, "utf-8");
      return JSON.parse(data);
    } catch (err: any) {
      if (err.code === "ENOENT") {
        await fs.writeFile(commentsFilePath, "[]", "utf-8");
        return [];
      }
      throw err;
    }
  } catch (err) {
    console.error("[Comments File Fallback] Error reading comments file:", err);
    return [];
  }
}

async function writeCommentsFile(comments: any[]): Promise<boolean> {
  try {
    await fs.mkdir(path.dirname(commentsFilePath), { recursive: true });
    await fs.writeFile(commentsFilePath, JSON.stringify(comments, null, 2), "utf-8");
    return true;
  } catch (err) {
    console.error("[Comments File Fallback] Error writing comments file:", err);
    return false;
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const chapterId = searchParams.get("chapterId");
    const mangaId = searchParams.get("mangaId");

    if (!chapterId && !mangaId) {
      return NextResponse.json({ error: "Missing chapterId or mangaId" }, { status: 400 });
    }

    const supabase = await createClient();
    let dbQuery = supabase
      .from("comments")
      .select(`
        id,
        chapter_id,
        manga_id,
        user_id,
        content,
        is_spoiler,
        is_moderated,
        created_at,
        parent_id,
        profiles:profiles!user_id (
          username,
          avatar_url,
          is_premium
        ),
        comment_likes (
          user_id
        ),
        comment_reports (
          user_id,
          report_type
        )
      `);

    if (chapterId) {
      dbQuery = dbQuery.eq("chapter_id", chapterId);
    } else {
      dbQuery = dbQuery.eq("manga_id", mangaId).eq("chapter_id", "general");
    }

    const { data, error } = await dbQuery.order("created_at", { ascending: false });

    if (error) {
      console.warn("[Comments API] Error al consultar Supabase. Usando fallback de archivos locales (.next/comments.json):", error.message);
      const fileComments = await readCommentsFile();
      let filtered = fileComments;
      if (chapterId) {
        filtered = filtered.filter((c) => c.chapterId === chapterId);
      } else {
        filtered = filtered.filter((c) => c.mangaId === mangaId && (c.chapterId === "general" || !c.chapterId));
      }
      filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      // Fetch profiles dynamically from Supabase for these users
      const userIds = Array.from(new Set(filtered.map((c) => c.userId).filter(Boolean)));
      if (userIds.length > 0) {
        try {
          const { data: dbProfiles } = await supabase
            .from("profiles")
            .select("id, username, avatar_url, is_premium")
            .in("id", userIds);

          if (dbProfiles) {
            const profileMap = new Map(dbProfiles.map((p: any) => [p.id, p]));
            filtered = filtered.map((c) => {
              const prof = profileMap.get(c.userId);
              return {
                ...c,
                userName: prof?.username || c.userName || "Usuario",
                userAvatar: prof?.avatar_url || c.userAvatar || null,
                userIsPremium: prof ? !!prof.is_premium : !!c.userIsPremium,
              };
            });
          }
        } catch (profileErr) {
          console.warn("[Comments API Fallback] Error fetching profiles dynamically:", profileErr);
        }
      }

      return NextResponse.json(filtered);
    }

    const mappedComments = (data || []).map((c: any) => {
      const likes = (c.comment_likes || []).map((l: any) => l.user_id);
      const reportedWords = (c.comment_reports || []).filter((r: any) => r.report_type === "words").length;
      const reportedSpoiler = (c.comment_reports || []).filter((r: any) => r.report_type === "spoiler").length;
      const isSpoiler = c.is_spoiler || reportedSpoiler >= 3;
      const isModerated = c.is_moderated || reportedWords >= 5;

      return {
        id: c.id,
        chapterId: c.chapter_id,
        mangaId: c.manga_id,
        userId: c.user_id,
        userName: c.profiles?.username || "Usuario",
        userAvatar: c.profiles?.avatar_url || null,
        userIsPremium: !!c.profiles?.is_premium,
        content: c.content,
        isSpoiler,
        isModerated,
        likes,
        reportedWords,
        reportedSpoiler,
        createdAt: c.created_at,
        parentId: c.parent_id || null,
      };
    });

    return NextResponse.json(mappedComments);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { chapterId, mangaId, userId, userName, userAvatar, content, isSpoiler, userIsPremium, parentId } = body;

    if (!mangaId || !userId || !userName || !content) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user || user.id !== userId) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }

    const resolvedChapterId = chapterId || "general";

    // Intentar escribir en Supabase
    const { data: newComment, error } = await supabase
      .from("comments")
      .insert({
        chapter_id: resolvedChapterId,
        manga_id: mangaId,
        user_id: userId,
        content: content.trim(),
        is_spoiler: !!isSpoiler,
        parent_id: parentId || null,
      })
      .select(`
        id,
        chapter_id,
        manga_id,
        user_id,
        content,
        is_spoiler,
        is_moderated,
        created_at,
        parent_id,
        profiles:profiles!user_id (
          username,
          avatar_url,
          is_premium
        )
      `)
      .maybeSingle();

    // Fallback si la tabla no existe
    if (error && (
      error.code === "P0001" ||
      error.code === "PGRST205" ||
      error.code === "42P01" ||
      error.code === "42703" ||
      error.message?.includes("relation") ||
      error.message?.includes("does not exist") ||
      error.message?.includes("column") ||
      error.message?.includes("schema cache")
    )) {
      console.warn("[Comments API] Fallback a archivo para inserción.");

      // Fetch the profile from Supabase to get the correct premium status and details
      let finalIsPremium = !!userIsPremium;
      let finalUserName = userName;
      let finalUserAvatar = userAvatar;
      try {
        const { data: dbProfile } = await supabase
          .from("profiles")
          .select("username, avatar_url, is_premium")
          .eq("id", userId)
          .maybeSingle();
        if (dbProfile) {
          finalIsPremium = !!dbProfile.is_premium;
          finalUserName = dbProfile.username || userName;
          finalUserAvatar = dbProfile.avatar_url || userAvatar;
        }
      } catch (profErr) {
        console.warn("[Comments POST Fallback] Error querying user profile:", profErr);
      }

      const fileComments = await readCommentsFile();
      const newFileComment: any = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        chapterId: resolvedChapterId,
        mangaId,
        userId,
        userName: finalUserName,
        userAvatar: finalUserAvatar || null,
        userIsPremium: finalIsPremium,
        content: content.trim(),
        isSpoiler: !!isSpoiler,
        isModerated: false,
        likes: [],
        reportedWords: 0,
        reportedSpoiler: 0,
        createdAt: new Date().toISOString(),
        parentId: parentId || null,
      };
      fileComments.push(newFileComment);
      const success = await writeCommentsFile(fileComments);
      if (!success) {
        return NextResponse.json({ error: "Failed to save comment in fallback file" }, { status: 500 });
      }

      // Disparar notificación de respuesta en segundo plano si corresponde
      if (parentId) {
        (async () => {
          try {
            const parentComment = fileComments.find((c) => c.id === parentId);
            if (parentComment && parentComment.userId !== userId) {
              const { triggerNotification } = await import("../notifications/helper");
              await triggerNotification({
                userId: parentComment.userId,
                type: "reply",
                senderId: userId,
                senderName: finalUserName,
                senderAvatar: finalUserAvatar,
                commentId: newFileComment.id,
                commentContent: content,
                mangaId,
                chapterId: resolvedChapterId,
              });
            }
          } catch (notifErr) {
            console.error("[Comments POST Fallback Notification] Error:", notifErr);
          }
        })();
      }

      return NextResponse.json(newFileComment, { status: 201 });
    }

    if (error || !newComment) {
      console.error("[Comments POST] DB error:", error);
      return NextResponse.json({ error: error?.message || "Failed to save comment" }, { status: 500 });
    }

    // Disparar notificación de respuesta en segundo plano si corresponde para Supabase
    if (parentId && resolvedChapterId && newComment) {
      (async () => {
        try {
          const { data: parentComment } = await supabase
            .from("comments")
            .select("user_id")
            .eq("id", parentId)
            .maybeSingle();

          if (parentComment && parentComment.user_id !== userId) {
            let finalIsPremium = !!userIsPremium;
            let finalUserName = userName;
            let finalUserAvatar = userAvatar;
            try {
              const { data: dbProfile } = await supabase
                .from("profiles")
                .select("username, avatar_url, is_premium")
                .eq("id", userId)
                .maybeSingle();
              if (dbProfile) {
                finalIsPremium = !!dbProfile.is_premium;
                finalUserName = dbProfile.username || userName;
                finalUserAvatar = dbProfile.avatar_url || userAvatar;
              }
            } catch (profErr) {
              console.warn("[Comments POST Notification] Error querying user profile:", profErr);
            }

            const { triggerNotification } = await import("../notifications/helper");
            await triggerNotification({
              userId: parentComment.user_id,
              type: "reply",
              senderId: userId,
              senderName: finalUserName,
              senderAvatar: finalUserAvatar,
              commentId: newComment.id,
              commentContent: content,
              mangaId,
              chapterId: resolvedChapterId,
            });
          }
        } catch (notifErr) {
          console.error("[Comments POST Supabase Notification] Error:", notifErr);
        }
      })();
    }

    return NextResponse.json({
      id: newComment.id,
      chapterId: newComment.chapter_id,
      mangaId: newComment.manga_id,
      userId: newComment.user_id,
      userName: (newComment.profiles as any)?.username || userName,
      userAvatar: (newComment.profiles as any)?.avatar_url || userAvatar || null,
      userIsPremium: !!(newComment.profiles as any)?.is_premium,
      content: newComment.content,
      isSpoiler: newComment.is_spoiler,
      isModerated: !!newComment.is_moderated,
      likes: [],
      reportedWords: 0,
      reportedSpoiler: 0,
      createdAt: newComment.created_at,
      parentId: newComment.parent_id || null,
    }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const commentId = searchParams.get("commentId");

    if (!commentId) {
      return NextResponse.json({ error: "Missing commentId" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(commentId);

    if (!isUuid) {
      // Si no es un UUID, definitivamente es un comentario del fallback de archivos locales (.next/comments.json)
      console.log("[Comments API] ID no es UUID, borrando de archivo local.");
      const fileComments = await readCommentsFile();
      const commentIndex = fileComments.findIndex((c) => c.id === commentId);

      if (commentIndex === -1) {
        return NextResponse.json({ error: "Comentario no encontrado" }, { status: 404 });
      }

      if (fileComments[commentIndex].userId !== user.id) {
        return NextResponse.json({ error: "No autorizado para borrar este comentario" }, { status: 403 });
      }

      fileComments.splice(commentIndex, 1);
      const success = await writeCommentsFile(fileComments);
      if (!success) {
        return NextResponse.json({ error: "Failed to delete comment in fallback file" }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }

    // Si es un UUID, intentamos borrar en Supabase
    const { error: dbError } = await supabase
      .from("comments")
      .delete()
      .eq("id", commentId)
      .eq("user_id", user.id);

    if (dbError) {
      // Si hay un error de conexión o de tabla no existente, intentamos borrar del archivo fallback por si acaso
      console.warn("[Comments DELETE] DB error, intentando fallback:", dbError.message);
      const fileComments = await readCommentsFile();
      const commentIndex = fileComments.findIndex((c) => c.id === commentId);
      if (commentIndex !== -1 && fileComments[commentIndex].userId === user.id) {
        fileComments.splice(commentIndex, 1);
        await writeCommentsFile(fileComments);
        return NextResponse.json({ success: true });
      }
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    // Limpieza de seguridad en el archivo fallback si se borró con éxito en Supabase
    const fileComments = await readCommentsFile();
    const commentIndex = fileComments.findIndex((c) => c.id === commentId);
    if (commentIndex !== -1 && fileComments[commentIndex].userId === user.id) {
      fileComments.splice(commentIndex, 1);
      await writeCommentsFile(fileComments);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
