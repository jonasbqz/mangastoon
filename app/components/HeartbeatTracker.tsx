"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "../utils/supabase/client";

// Generar o recuperar session_id único para la pestaña actual de forma segura
const getSessionId = (): string => {
  if (typeof window === "undefined") return "";
  let id = sessionStorage.getItem("mangastoon_session_id");
  if (!id) {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      id = crypto.randomUUID();
    } else {
      id = Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    }
    sessionStorage.setItem("mangastoon_session_id", id);
  }
  return id;
};

export default function HeartbeatTracker() {
  const pathname = usePathname();

  useEffect(() => {
    const supabase = createClient();
    const sessionId = getSessionId();

    const sendPing = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id || null;

        // Upsert de la presencia en la base de datos
        const { error } = await supabase.from("user_presence").upsert({
          session_id: sessionId,
          user_id: userId,
          path: pathname,
          last_active: new Date().toISOString(),
        }, {
          onConflict: "session_id",
        });

        if (error) {
          console.warn("[Heartbeat] Error upserting presence:", error.message);
        }
      } catch (err) {
        // Silenciar en producción para no ensuciar la consola del cliente
        console.warn("[Heartbeat] Ping exception:", err);
      }
    };

    // Ping inmediato al montar el componente o cambiar de ruta
    sendPing();

    // Ping periódico cada 45 segundos
    const interval = setInterval(sendPing, 45000);

    return () => {
      clearInterval(interval);
    };
  }, [pathname]);

  return null;
}
