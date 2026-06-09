"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "../../../utils/supabase/client";
import {
  Users,
  AlertTriangle,
  ShieldCheck,
  LogOut,
  RefreshCw,
  Search,
  CheckCircle,
  ExternalLink,
  Plus,
  Trash2,
  TrendingUp,
  Globe,
  MessageSquare,
  Cpu,
  Send
} from "lucide-react";
import "../admin.css";

const supabase = createClient();

type Profile = {
  id: string;
  username: string | null;
  is_admin: boolean;
  avatar_url: string | null;
};

type ActiveUser = {
  id: string;
  session_id: string;
  path: string;
  last_active: string;
  user_id: string | null;
  profiles?: {
    username: string | null;
  } | null;
};

type BrokenChapter = {
  id: string;
  manga_id: string;
  manga_title: string;
  chapter_id: string;
  chapter_number: string;
  detected_at: string;
};

type ActiveTab = "dashboard" | "broken-chapters" | "team" | "failed-searches" | "comment-moderation" | "scraper-queue" | "telegram" | "readers";

export default function AdminClient() {
  const [session, setSession] = useState<any>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authChecking, setAuthChecking] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>("dashboard");

  // Login Form States
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginSuccess, setLoginSuccess] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const turnstileContainerRef = useRef<HTMLDivElement>(null);

  // Dashboard Data States
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [brokenChapters, setBrokenChapters] = useState<BrokenChapter[]>([]);
  const [adminTeam, setAdminTeam] = useState<Profile[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Team Management States
  const [newAdminId, setNewAdminId] = useState("");
  const [teamError, setTeamError] = useState<string | null>(null);
  const [teamSuccess, setTeamSuccess] = useState<string | null>(null);

  // Phase 2 States
  const [failedSearches, setFailedSearches] = useState<any[]>([]);
  const [reportedComments, setReportedComments] = useState<any[]>([]);
  const [scraperQueue, setScraperQueue] = useState<any[]>([]);

  // Scraper Form States
  const [scraperMangaTitle, setScraperMangaTitle] = useState("");
  const [scraperSourceUrl, setScraperSourceUrl] = useState("");
  const [scraperPriority, setScraperPriority] = useState<number>(0);
  const [scraperStatusMsg, setScraperStatusMsg] = useState<string | null>(null);
  const [scraperLoading, setScraperLoading] = useState(false);

  // Telegram Form States (loaded inside useEffect to support Next.js SSR hydration safely)
  const [telegramBotToken, setTelegramBotToken] = useState("");
  const [telegramChatId, setTelegramChatId] = useState("-1003763338725");
  const [announcementText, setAnnouncementText] = useState("");
  const [announcementStatus, setAnnouncementStatus] = useState<string | null>(null);
  const [announcementLoading, setAnnouncementLoading] = useState(false);

  // Reader Management States
  const [readerSearchQuery, setReaderSearchQuery] = useState("");
  const [readerSearchResults, setReaderSearchResults] = useState<any[]>([]);
  const [searchingReaders, setSearchingReaders] = useState(false);
  const [selectedReader, setSelectedReader] = useState<any | null>(null);
  const [readerEditPremium, setReaderEditPremium] = useState(false);
  const [readerEditPremiumType, setReaderEditPremiumType] = useState("gifted");
  const [readerEditPremiumUntil, setReaderEditPremiumUntil] = useState("");
  const [readerError, setReaderError] = useState<string | null>(null);
  const [readerSuccess, setReaderSuccess] = useState<string | null>(null);

  // Google Analytics States
  const [analyticsData, setAnalyticsData] = useState<any | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  // Load localstorage values on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      setTelegramBotToken(localStorage.getItem("admin_tg_token") || "");
      setTelegramChatId(localStorage.getItem("admin_tg_chat_id") || "-1003763338725");
    }
  }, []);

  // 1. Auth Listener
  useEffect(() => {
    supabase.auth.getSession().then((res: any) => {
      const session = res?.data?.session;
      setSession(session);
      if (session) {
        checkAdminStatus(session.user.id);
      } else {
        setAuthChecking(false);
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      setSession(session);
      if (session) {
        checkAdminStatus(session.user.id);
      } else {
        setCurrentUserProfile(null);
        setAuthChecking(false);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // 1b. Load Turnstile script dynamically
  useEffect(() => {
    if (session && currentUserProfile) return;
    if (document.getElementById("turnstile-script")) return;

    const script = document.createElement("script");
    script.id = "turnstile-script";
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
  }, [session, currentUserProfile]);

  // 1c. Render Turnstile Widget
  useEffect(() => {
    if (session && currentUserProfile) return;

    let turnstileId: string | null = null;
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "0x4AAAAAADWKN1xJkjzWCcOP";

    const interval = setInterval(() => {
      if ((window as any).turnstile && turnstileContainerRef.current) {
        clearInterval(interval);
        try {
          // Remove previous widget if existed
          if (turnstileId !== null) {
            try { (window as any).turnstile.remove(turnstileId); } catch (e) {}
          }

          turnstileId = (window as any).turnstile.render(turnstileContainerRef.current, {
            sitekey: siteKey,
            callback: (token: string) => {
              setCaptchaToken(token);
            },
            "error-callback": () => {
              setCaptchaToken(null);
            },
            "expired-callback": () => {
              setCaptchaToken(null);
            }
          });
        } catch (e) {
          console.error("[Turnstile] Render error:", e);
        }
      }
    }, 300);

    return () => {
      clearInterval(interval);
      if ((window as any).turnstile && turnstileId !== null) {
        try {
          (window as any).turnstile.remove(turnstileId);
        } catch (e) {}
      }
    };
  }, [session, currentUserProfile]);

  // Check if logged-in user is actually an admin
  const checkAdminStatus = async (userId: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, is_admin, avatar_url")
        .eq("id", userId)
        .single();

      if (error || !data) {
        setCurrentUserProfile(null);
        await supabase.auth.signOut();
        setLoginError("No se pudo obtener el perfil de usuario.");
      } else if (!data.is_admin) {
        setCurrentUserProfile(null);
        await supabase.auth.signOut();
        setLoginError("Acceso denegado: Esta cuenta no posee permisos de administrador.");
      } else {
        setCurrentUserProfile(data as Profile);
      }
    } catch (err) {
      console.error(err);
      setLoginError("Ocurrió un error inesperado al validar privilegios.");
    } finally {
      setAuthChecking(false);
      setLoading(false);
    }
  };

  // 2. Fetch data (dashboard, users, chapters, team)
  const fetchData = async () => {
    if (!currentUserProfile?.is_admin) return;
    setRefreshing(true);
    try {
      // a. Active presence (last 3 minutes)
      const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000).toISOString();
      
      const { data: presenceData, error: presenceError } = await supabase
        .from("user_presence")
        .select(`
          id, session_id, path, last_active, user_id,
          profiles:user_id ( username )
        `)
        .gt("last_active", threeMinutesAgo)
        .order("last_active", { ascending: false });

      if (!presenceError && presenceData) {
        const formattedUsers = (presenceData as any[]).map(item => ({
          id: item.id,
          session_id: item.session_id,
          path: item.path,
          last_active: item.last_active,
          user_id: item.user_id,
          profiles: item.profiles ? { username: item.profiles.username } : null
        }));
        setActiveUsers(formattedUsers);
      }

      // b. Broken chapters
      const { data: brokenData, error: brokenError } = await supabase
        .from("broken_chapters")
        .select("*")
        .order("detected_at", { ascending: false });

      if (!brokenError && brokenData) {
        setBrokenChapters(brokenData as BrokenChapter[]);
      }

      // c. Admin team list
      const { data: teamData, error: teamError } = await supabase
        .from("profiles")
        .select("id, username, is_admin, avatar_url")
        .eq("is_admin", true)
        .order("username", { ascending: true });

      if (!teamError && teamData) {
        setAdminTeam(teamData as Profile[]);
      }

      // d. Dynamic active tab data
      if (activeTab === "dashboard") {
        await fetchAnalytics();
      } else if (activeTab === "failed-searches") {
        await fetchFailedSearches();
      } else if (activeTab === "comment-moderation") {
        await fetchReportedComments();
      } else if (activeTab === "scraper-queue") {
        await fetchScraperQueue();
      }
    } catch (error) {
      console.error("[FetchData Error]", error);
    } finally {
      setRefreshing(false);
    }
  };

  const groupReportedComments = (reportsData: any[]) => {
    const groupedMap: { [key: string]: any } = {};
    
    reportsData.forEach((item: any) => {
      const comment = item.comments;
      if (!comment) return;
      
      const commentId = comment.id;
      if (!groupedMap[commentId]) {
        groupedMap[commentId] = {
          id: commentId,
          content: comment.content,
          mangaId: comment.manga_id,
          chapterId: comment.chapter_id,
          createdAt: comment.created_at,
          username: comment.profiles?.username || "Usuario",
          reportedWords: 0,
          reportedSpoiler: 0,
          reports: []
        };
      }
      
      groupedMap[commentId].reports.push({
        id: item.id,
        type: item.report_type,
        createdAt: item.created_at
      });
      
      if (item.report_type === "words") {
        groupedMap[commentId].reportedWords++;
      } else if (item.report_type === "spoiler") {
        groupedMap[commentId].reportedSpoiler++;
      }
    });
    
    return Object.values(groupedMap);
  };

  const fetchFailedSearches = async () => {
    try {
      const { data, error } = await supabase
        .from("failed_searches")
        .select("*")
        .order("count", { ascending: false });
      if (!error && data) {
        setFailedSearches(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchReportedComments = async () => {
    try {
      const { data, error } = await supabase
        .from("comment_reports")
        .select(`
          id,
          report_type,
          created_at,
          comment_id,
          comments:comments!comment_id (
            id,
            content,
            manga_id,
            chapter_id,
            created_at,
            user_id,
            profiles:profiles!user_id (
              username
            )
          )
        `);
      if (!error && data) {
        setReportedComments(groupReportedComments(data));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchScraperQueue = async () => {
    try {
      const { data, error } = await supabase
        .from("scraper_queue")
        .select("*")
        .order("priority", { ascending: false })
        .order("requested_at", { ascending: false });
      if (!error && data) {
        setScraperQueue(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Actions
  const handleResolveSearch = async (searchId: string) => {
    try {
      const { error } = await supabase
        .from("failed_searches")
        .delete()
        .eq("id", searchId);
      if (error) {
        alert(`Error al resolver búsqueda: ${error.message}`);
      } else {
        setFailedSearches(prev => prev.filter(s => s.id !== searchId));
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleEnqueueSearch = (query: string) => {
    setScraperMangaTitle(query);
    setScraperSourceUrl("");
    setActiveTab("scraper-queue");
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!window.confirm("¿Estás seguro de que querés borrar este comentario de forma permanente?")) return;
    try {
      const { error } = await supabase
        .from("comments")
        .delete()
        .eq("id", commentId);
        
      if (error) {
        alert(`Error al borrar comentario: ${error.message}`);
      } else {
        setReportedComments(prev => prev.filter(c => c.id !== commentId));
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleDismissReports = async (commentId: string) => {
    try {
      const { error } = await supabase
        .from("comment_reports")
        .delete()
        .eq("comment_id", commentId);
        
      if (error) {
        alert(`Error al descartar reportes: ${error.message}`);
      } else {
        setReportedComments(prev => prev.filter(c => c.id !== commentId));
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleEnqueueScrape = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scraperMangaTitle.trim() || !scraperSourceUrl.trim()) {
      setScraperStatusMsg("Por favor, completá todos los campos.");
      return;
    }
    setScraperLoading(true);
    setScraperStatusMsg(null);
    
    try {
      const { error } = await supabase
        .from("scraper_queue")
        .insert({
          manga_title: scraperMangaTitle.trim(),
          source_url: scraperSourceUrl.trim(),
          status: "pending",
          priority: Number(scraperPriority),
          requested_by: currentUserProfile?.id,
          requested_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
        
      if (error) {
        setScraperStatusMsg(`Error: ${error.message}`);
      } else {
        setScraperStatusMsg("Manga encolado con éxito.");
        setScraperMangaTitle("");
        setScraperSourceUrl("");
        setScraperPriority(0);
        fetchScraperQueue();
      }
    } catch (err: any) {
      setScraperStatusMsg(`Error: ${err.message}`);
    } finally {
      setScraperLoading(false);
    }
  };

  const handleDeleteQueueItem = async (itemId: string) => {
    if (!window.confirm("¿Seguro de que querés eliminar este item de la cola?")) return;
    try {
      const { error } = await supabase
        .from("scraper_queue")
        .delete()
        .eq("id", itemId);
      if (error) {
        alert(`Error: ${error.message}`);
      } else {
        setScraperQueue(prev => prev.filter(item => item.id !== itemId));
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleSendTelegramAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!telegramBotToken.trim() || !telegramChatId.trim() || !announcementText.trim()) {
      setAnnouncementStatus("⚠️ Por favor, completá todos los campos.");
      return;
    }
    
    setAnnouncementLoading(true);
    setAnnouncementStatus(null);
    
    try {
      localStorage.setItem("admin_tg_token", telegramBotToken.trim());
      localStorage.setItem("admin_tg_chat_id", telegramChatId.trim());
      
      const res = await fetch(`https://api.telegram.org/bot${telegramBotToken.trim()}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: telegramChatId.trim(),
          text: announcementText.trim(),
          parse_mode: "Markdown",
          disable_web_page_preview: true
        })
      });
      
      const data = await res.json();
      if (res.ok && data.ok) {
        setAnnouncementStatus("✅ Anuncio enviado con éxito.");
        setAnnouncementText("");
      } else {
        setAnnouncementStatus(`❌ Error de Telegram: ${data.description || "Desconocido"}`);
      }
    } catch (err: any) {
      setAnnouncementStatus(`❌ Error de red: ${err.message}`);
    } finally {
      setAnnouncementLoading(false);
    }
  };

  // Poll data periodically when logged in
  useEffect(() => {
    if (currentUserProfile?.is_admin) {
      fetchData();
      const interval = setInterval(fetchData, 10000); // Polling cada 10 segundos
      return () => clearInterval(interval);
    }
  }, [currentUserProfile, activeTab]);

  // Cargar datos al cambiar de pestaña
  useEffect(() => {
    if (!currentUserProfile?.is_admin) return;
    if (activeTab === "dashboard") {
      fetchAnalytics();
    } else if (activeTab === "failed-searches") {
      fetchFailedSearches();
    } else if (activeTab === "comment-moderation") {
      fetchReportedComments();
    } else if (activeTab === "scraper-queue") {
      fetchScraperQueue();
    }
  }, [activeTab, currentUserProfile]);

  // Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loginLoading) return;
    setLoginError(null);
    setLoginLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
        options: {
          captchaToken: captchaToken || undefined,
        }
      });

      if (error) {
        setLoginError(error.message);
        if ((window as any).turnstile) {
          try { (window as any).turnstile.reset(); } catch (e) {}
        }
        setCaptchaToken(null);
      }
    } catch (err: any) {
      setLoginError("Error de red o servidor al intentar iniciar sesión.");
    } finally {
      setLoginLoading(false);
    }
  };

  // Handle Logout
  const handleLogout = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    setCurrentUserProfile(null);
    setSession(null);
    setLoading(false);
  };

  // Handle Magic Link (OTP) Login bypasses password Captchas in production
  const handleMagicLink = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (loginLoading) return;
    setLoginError(null);
    setLoginSuccess(null);
    setLoginLoading(true);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: window.location.origin,
          captchaToken: captchaToken || undefined,
        }
      });

      if (error) {
        setLoginError(error.message);
        if ((window as any).turnstile) {
          try { (window as any).turnstile.reset(); } catch (e) {}
        }
        setCaptchaToken(null);
      } else {
        setLoginSuccess("¡Enlace enviado! Revisá tu bandeja de entrada de " + email + " para ingresar.");
      }
    } catch (err: any) {
      setLoginError("Error de red al intentar enviar el enlace de acceso.");
    } finally {
      setLoginLoading(false);
    }
  };

  // Resolve Broken Chapter (delete from alerts)
  const handleResolveChapter = async (id: string) => {
    try {
      const { error } = await supabase
        .from("broken_chapters")
        .delete()
        .eq("id", id);

      if (error) {
        alert("Error al resolver el capítulo: " + error.message);
      } else {
        setBrokenChapters(prev => prev.filter(ch => ch.id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Add new administrator
  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setTeamError(null);
    setTeamSuccess(null);

    const uid = newAdminId.trim();
    if (!uid) {
      setTeamError("Por favor, ingresá un UID de usuario válido.");
      return;
    }

    try {
      // 1. Verificar si el perfil existe
      const { data: profile, error: fetchError } = await supabase
        .from("profiles")
        .select("id, username")
        .eq("id", uid)
        .maybeSingle();

      if (fetchError || !profile) {
        setTeamError("No se encontró ningún perfil de usuario con ese UID.");
        return;
      }

      // 2. Hacer upsert o update del is_admin en true
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ is_admin: true })
        .eq("id", uid);

      if (updateError) {
        setTeamError("Error al promover al usuario: " + updateError.message + " (Asegurá políticas RLS de profiles)");
        return;
      }

      setTeamSuccess(`¡Usuario ${profile.username || uid} promovido a Administrador con éxito!`);
      setNewAdminId("");
      fetchData();
    } catch (err: any) {
      setTeamError("Error al intentar promover al administrador.");
    }
  };

  // Revoke Admin privileges
  const handleRevokeAdmin = async (id: string, username: string | null) => {
    if (id === currentUserProfile?.id) {
      alert("No podés revocarte el permiso a vos mismo, ¡te quedarías fuera del panel!");
      return;
    }

    const confirm = window.confirm(`¿Estás seguro de que querés revocar el rol de Administrador a ${username || id}?`);
    if (!confirm) return;

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ is_admin: false })
        .eq("id", id);

      if (error) {
        alert("Error al revocar privilegios: " + error.message);
      } else {
        setAdminTeam(prev => prev.filter(member => member.id !== id));
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Fetch Google Analytics v4 Data
  const fetchAnalytics = async () => {
    setLoadingAnalytics(true);
    try {
      const response = await fetch("/api/analytics");
      if (response.ok) {
        const data = await response.json();
        setAnalyticsData(data);
      } else {
        console.error("Failed to fetch analytics: status", response.status);
      }
    } catch (err) {
      console.error("Error fetching analytics:", err);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  // Search readers by username
  const handleSearchReaders = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!readerSearchQuery.trim()) return;

    setSearchingReaders(true);
    setReaderError(null);
    setReaderSuccess(null);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, avatar_url, is_premium, premium_type, premium_until, is_admin")
        .ilike("username", `%${readerSearchQuery.trim()}%`)
        .order("username", { ascending: true });

      if (error) {
        setReaderError("Error al buscar lectores: " + error.message);
      } else {
        setReaderSearchResults(data || []);
        if (data && data.length === 0) {
          setReaderError("No se encontraron lectores con ese nombre de usuario.");
        }
      }
    } catch (err: any) {
      setReaderError("Error de red al buscar lectores.");
    } finally {
      setSearchingReaders(false);
    }
  };

  // Select a reader to edit
  const handleSelectReader = (reader: any) => {
    setSelectedReader(reader);
    setReaderEditPremium(reader.is_premium || false);
    setReaderEditPremiumType(reader.premium_type || "gifted");
    setReaderEditPremiumUntil(
      reader.premium_until 
        ? new Date(reader.premium_until).toISOString().split("T")[0] 
        : ""
    );
    setReaderError(null);
    setReaderSuccess(null);
  };

  // Update a reader's premium status
  const handleUpdateReaderPremium = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReader) return;

    setReaderError(null);
    setReaderSuccess(null);

    const untilDate = readerEditPremium && readerEditPremiumUntil ? new Date(readerEditPremiumUntil).toISOString() : null;

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          is_premium: readerEditPremium,
          premium_type: readerEditPremium ? readerEditPremiumType : null,
          premium_until: untilDate
        })
        .eq("id", selectedReader.id);

      if (error) {
        setReaderError("Error al actualizar lector: " + error.message + " (Asegurá políticas RLS de profiles)");
      } else {
        setReaderSuccess(`¡Perfil de ${selectedReader.username || selectedReader.id} actualizado con éxito!`);
        
        // Update local state list
        setReaderSearchResults(prev =>
          prev.map(r =>
            r.id === selectedReader.id
              ? { ...r, is_premium: readerEditPremium, premium_type: readerEditPremium ? readerEditPremiumType : null, premium_until: untilDate }
              : r
          )
        );
        setSelectedReader((prev: any) => ({
          ...prev,
          is_premium: readerEditPremium,
          premium_type: readerEditPremium ? readerEditPremiumType : null,
          premium_until: untilDate
        }));
      }
    } catch (err: any) {
      setReaderError("Error de red al intentar actualizar el perfil.");
    }
  };

  // Loading Screen
  if (authChecking || (session && loading && !currentUserProfile)) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p style={{ fontFamily: "var(--font-heading)", fontSize: "12px", letterSpacing: "1px", color: "var(--text-secondary)", textTransform: "uppercase" }}>
          Validando Credenciales
        </p>
      </div>
    );
  }

  // ─── LOGIN SCREEN ────────────────────────────────────────────────────────
  if (!session || !currentUserProfile) {
    return (
      <div className="login-container">
        <div className="login-glow"></div>
        <div className="login-card glass-panel fade-in">
          <div className="login-logo">MangaStoon</div>
          <div className="login-subtitle">Panel de Control Administrativo</div>

          {loginError && <div className="login-error">{loginError}</div>}
          {loginSuccess && (
            <div className="badge badge-green" style={{ width: "100%", padding: "10px", borderRadius: "var(--radius-sm)", marginBottom: "16px", textTransform: "none" }}>
              {loginSuccess}
            </div>
          )}

          <form className="login-form" onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label">Correo Electrónico</label>
              <input
                type="email"
                required
                placeholder="ejemplo@correo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Contraseña (opcional para Magic Link)</label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {/* Cloudflare Turnstile Captcha container */}
            <div className="form-group" style={{ display: "flex", justifyContent: "center", margin: "14px 0 6px 0", minHeight: "65px" }}>
              <div ref={turnstileContainerRef} id="turnstile-container"></div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "10px" }}>
              <button type="submit" className="btn-primary" disabled={loginLoading || !email || !captchaToken}>
                {loginLoading ? "Procesando..." : "Iniciar con Contraseña"}
              </button>

              <button type="button" className="btn-secondary" onClick={handleMagicLink} disabled={loginLoading || !email || !captchaToken}>
                {loginLoading ? "Enviando..." : "Enviar Acceso por Email (Magic Link)"}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // ─── PANEL ADMINISTRATIVO ────────────────────────────────────────────────
  return (
    <div className="dashboard-container">
      
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          MangaStoon
          <span className="sidebar-brand-sub">PANEL</span>
        </div>

        <nav style={{ flexGrow: 1 }}>
          <ul className="sidebar-menu">
            <li
              className={`sidebar-item ${activeTab === "dashboard" ? "active" : ""}`}
              onClick={() => setActiveTab("dashboard")}
            >
              <TrendingUp size={16} />
              <span>General</span>
            </li>
            <li
              className={`sidebar-item ${activeTab === "broken-chapters" ? "active" : ""}`}
              onClick={() => setActiveTab("broken-chapters")}
            >
              <AlertTriangle size={16} />
              <span>Capítulos Rotos</span>
              {brokenChapters.length > 0 && (
                <span className="badge badge-red" style={{ marginLeft: "auto", padding: "2px 6px", fontSize: "8px" }}>
                  {brokenChapters.length}
                </span>
              )}
            </li>
            <li
              className={`sidebar-item ${activeTab === "failed-searches" ? "active" : ""}`}
              onClick={() => setActiveTab("failed-searches")}
            >
              <Search size={16} />
              <span>Búsquedas Fallidas</span>
              {failedSearches.length > 0 && (
                <span className="badge badge-yellow" style={{ marginLeft: "auto", padding: "2px 6px", fontSize: "8px" }}>
                  {failedSearches.length}
                </span>
              )}
            </li>
            <li
              className={`sidebar-item ${activeTab === "comment-moderation" ? "active" : ""}`}
              onClick={() => setActiveTab("comment-moderation")}
            >
              <MessageSquare size={16} />
              <span>Moderación</span>
              {reportedComments.length > 0 && (
                <span className="badge badge-red" style={{ marginLeft: "auto", padding: "2px 6px", fontSize: "8px" }}>
                  {reportedComments.length}
                </span>
              )}
            </li>
            <li
              className={`sidebar-item ${activeTab === "scraper-queue" ? "active" : ""}`}
              onClick={() => setActiveTab("scraper-queue")}
            >
              <Cpu size={16} />
              <span>Cola Scraper</span>
              {scraperQueue.filter(x => x.status === "pending" || x.status === "processing").length > 0 && (
                <span className="badge badge-blue" style={{ marginLeft: "auto", padding: "2px 6px", fontSize: "8px" }}>
                  {scraperQueue.filter(x => x.status === "pending" || x.status === "processing").length}
                </span>
              )}
            </li>
            <li
              className={`sidebar-item ${activeTab === "telegram" ? "active" : ""}`}
              onClick={() => setActiveTab("telegram")}
            >
              <Send size={16} />
              <span>Telegram Bot</span>
            </li>
            <li
              className={`sidebar-item ${activeTab === "readers" ? "active" : ""}`}
              onClick={() => setActiveTab("readers")}
            >
              <Users size={16} />
              <span>Lectores / Premium</span>
            </li>
            <li
              className={`sidebar-item ${activeTab === "team" ? "active" : ""}`}
              onClick={() => setActiveTab("team")}
            >
              <ShieldCheck size={16} />
              <span>Administradores</span>
            </li>
          </ul>
        </nav>

        {/* User Card */}
        <div className="sidebar-user">
          <div className="sidebar-user-info">
            <div className="sidebar-avatar">
              {currentUserProfile.username ? currentUserProfile.username.substring(0, 2).toUpperCase() : "AD"}
            </div>
            <div className="sidebar-user-text">
              <span className="sidebar-user-name">{currentUserProfile.username || "Administrador"}</span>
              <span className="sidebar-user-role">Dueño / GDE</span>
            </div>
          </div>
          <button className="btn-secondary" style={{ padding: "8px", width: "100%", fontSize: "11px" }} onClick={handleLogout}>
            <LogOut size={12} />
            <span>Desconectarse</span>
          </button>
        </div>
      </aside>

      {/* Main Content Pane */}
      <main className="main-content fade-in">
        
        {/* Header Area */}
        <header className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 className="page-title">
              {activeTab === "dashboard" && "Resumen en Tiempo Real"}
              {activeTab === "broken-chapters" && "Reportes de Capítulos Rotos"}
              {activeTab === "failed-searches" && "Búsquedas Fallidas"}
              {activeTab === "comment-moderation" && "Moderación de Comentarios"}
              {activeTab === "scraper-queue" && "Cola del Scraper"}
              {activeTab === "telegram" && "Anuncios de Telegram"}
              {activeTab === "readers" && "Gestión de Lectores y Premium"}
              {activeTab === "team" && "Equipo de Administradores"}
            </h1>
            <p className="page-subtitle">
              {activeTab === "dashboard" && "Monitoreo de actividad, telemetría y presencia activa."}
              {activeTab === "broken-chapters" && "Gestión de páginas vacías detectadas en MangaStoon."}
              {activeTab === "failed-searches" && "Registro de búsquedas que retornaron 0 resultados en la plataforma."}
              {activeTab === "comment-moderation" && "Revisión y gestión de comentarios reportados por la comunidad."}
              {activeTab === "scraper-queue" && "Priorización y monitoreo de tareas de extracción de contenido."}
              {activeTab === "telegram" && "Envío directo de comunicados al canal oficial de la comunidad."}
              {activeTab === "readers" && "Búsqueda de usuarios, control de estado Premium, tipo de VIP y vencimientos."}
              {activeTab === "team" && "Asignación, edición y revocación de permisos administrativos."}
            </p>
          </div>

          <button className="btn-secondary" onClick={fetchData} disabled={refreshing} style={{ padding: "10px 16px" }}>
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            <span>{refreshing ? "Actualizando" : "Refrescar"}</span>
          </button>
        </header>

        {/* ─── TAB: DASHBOARD ──────────────────────────────────────────────── */}
        {activeTab === "dashboard" && (
          <div>
            {/* Cards Grid */}
            <div className="stats-grid">
              <div className="stat-card glass-panel">
                <div className="stat-info">
                  <span className="stat-label">Usuarios en línea (3m)</span>
                  <span className="stat-value">{activeUsers.length}</span>
                </div>
                <div className="stat-icon-wrapper green">
                  <Users size={20} />
                </div>
              </div>

              <div className="stat-card glass-panel">
                <div className="stat-info">
                  <span className="stat-label">Capítulos Rotos Activos</span>
                  <span className="stat-value">{brokenChapters.length}</span>
                </div>
                <div className="stat-icon-wrapper red">
                  <AlertTriangle size={20} />
                </div>
              </div>

              <div className="stat-card glass-panel">
                <div className="stat-info">
                  <span className="stat-label">Equipo de Soporte</span>
                  <span className="stat-value">{adminTeam.length}</span>
                </div>
                <div className="stat-icon-wrapper blue">
                  <ShieldCheck size={20} />
                </div>
              </div>
            </div>

            {/* StoonAnalytics Telemetry Section */}
            <div className="analytics-section" style={{ marginTop: "32px", marginBottom: "32px" }}>
              <div className="section-title-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <h2 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "8px", fontFamily: "var(--font-heading)" }}>
                  <TrendingUp size={18} className="text-primary" />
                  Métricas de Telemetría StoonAnalytics (Últimos 30 días)
                </h2>
                {analyticsData?.isDemo && (
                  <span className="badge badge-yellow" style={{ fontSize: "10px" }}>Modo Simulación</span>
                )}
              </div>

              {loadingAnalytics && !analyticsData ? (
                <div className="glass-panel" style={{ padding: "40px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px" }}>
                  <div className="spinner"></div>
                  <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Cargando datos de telemetría nativa...</span>
                </div>
              ) : !analyticsData ? (
                <div className="glass-panel" style={{ padding: "30px", textAlign: "center" }}>
                  <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>No se pudieron obtener métricas de telemetría nativas.</p>
                </div>
              ) : (
                <div>
                  {/* KPI Cards Grid */}
                  <div className="stats-grid" style={{ marginBottom: "24px", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
                    <div className="stat-card glass-panel" style={{ padding: "16px 20px" }}>
                      <div className="stat-info">
                        <span className="stat-label">Visitas Totales</span>
                        <span className="stat-value" style={{ fontSize: "24px" }}>
                          {analyticsData.summary.screenPageViews.toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <div className="stat-card glass-panel" style={{ padding: "16px 20px" }}>
                      <div className="stat-info">
                        <span className="stat-label">Lectores Activos</span>
                        <span className="stat-value" style={{ fontSize: "24px" }}>
                          {analyticsData.summary.activeUsers.toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <div className="stat-card glass-panel" style={{ padding: "16px 20px" }}>
                      <div className="stat-info">
                        <span className="stat-label">Duración Media</span>
                        <span className="stat-value" style={{ fontSize: "24px" }}>
                          {analyticsData.summary.averageSessionDuration}
                        </span>
                      </div>
                    </div>
                    <div className="stat-card glass-panel" style={{ padding: "16px 20px" }}>
                      <div className="stat-info">
                        <span className="stat-label">Sesiones</span>
                        <span className="stat-value" style={{ fontSize: "24px" }}>
                          {analyticsData.summary.sessions.toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <div className="stat-card glass-panel" style={{ padding: "16px 20px" }}>
                      <div className="stat-info">
                        <span className="stat-label">Carga Hojas (Prom)</span>
                        <span className="stat-value" style={{ fontSize: "24px", color: "var(--accent-blue)" }}>
                          {analyticsData.performance?.avgLoadTimeMs !== undefined ? (analyticsData.performance.avgLoadTimeMs / 1000).toFixed(2) + "s" : "0.00s"}
                        </span>
                      </div>
                    </div>
                    <div className="stat-card glass-panel" style={{ padding: "16px 20px" }}>
                      <div className="stat-info">
                        <span className="stat-label font-bold">Carga Exitosa</span>
                        <span className="stat-value" style={{ fontSize: "24px", color: "var(--accent-green)" }}>
                          {analyticsData.performance?.successRatePercentage !== undefined ? analyticsData.performance.successRatePercentage + "%" : "100%"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Main Analytics Visuals Row (Chart & Traffic Sources) */}
                  <div className="panel-grid" style={{ marginBottom: "24px" }}>
                    {/* SVG Visitas Diarias Chart */}
                    <div className="panel-card glass-panel" style={{ padding: "24px" }}>
                      <h3 className="panel-title" style={{ marginBottom: "20px", fontSize: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
                        <TrendingUp size={16} />
                        Tendencia Diaria de Vistas de Página
                      </h3>
                      {analyticsData.charts?.dailyViews && analyticsData.charts.dailyViews.length > 0 ? (
                        <div>
                          {/* Render the SVG Area/Line Chart */}
                          <div style={{ position: "relative", width: "100%", height: "180px" }}>
                            {(() => {
                              const points = analyticsData.charts.dailyViews;
                              const width = 600;
                              const height = 150;
                              const views = points.map((p: any) => p.views);
                              const maxVal = Math.max(...views, 100);
                              const minVal = Math.min(...views, 0);
                              const range = maxVal - minVal;

                              // Generate SVG path string
                              const pathPoints = points.map((p: any, idx: number) => {
                                const x = (idx / (points.length - 1)) * width;
                                const y = height - ((p.views - minVal) / range) * (height - 20) - 10;
                                return { x, y, val: p.views, date: p.date };
                              });

                              const linePath = pathPoints.map((p: any, idx: number) => 
                                `${idx === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`
                              ).join(" ");

                              const areaPath = `${linePath} L ${width} ${height} L 0 ${height} Z`;

                              return (
                                <svg
                                  viewBox={`0 0 ${width} ${height}`}
                                  width="100%"
                                  height="100%"
                                  preserveAspectRatio="none"
                                  style={{ overflow: "visible" }}
                                >
                                  <defs>
                                    <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.4" stroke="none" />
                                      <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.0" stroke="none" />
                                    </linearGradient>
                                  </defs>
                                  {/* Grid Lines */}
                                  <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke="rgba(255,107,0,0.05)" strokeDasharray="3,3" />
                                  <line x1="0" y1={height - 10} x2={width} y2={height - 10} stroke="rgba(255,107,0,0.1)" />
                                  
                                  {/* Area */}
                                  <path d={areaPath} fill="url(#chartGradient)" />
                                  {/* Line */}
                                  <path d={linePath} fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                  
                                  {/* Dots for hover references */}
                                  {pathPoints.filter((_: any, i: number) => i % 5 === 0 || i === pathPoints.length - 1).map((p: any, idx: number) => (
                                    <g key={idx}>
                                      <circle cx={p.x} cy={p.y} r="4" fill="var(--primary)" stroke="var(--bg-secondary)" strokeWidth="1.5" />
                                    </g>
                                  ))}
                                </svg>
                              );
                            })()}
                          </div>
                          {/* X-axis labels */}
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "var(--text-muted)", marginTop: "8px", borderTop: "1px solid rgba(255,107,0,0.08)", paddingTop: "8px" }}>
                            <span>{analyticsData.charts.dailyViews[0]?.date}</span>
                            <span>{analyticsData.charts.dailyViews[Math.floor(analyticsData.charts.dailyViews.length / 2)]?.date}</span>
                            <span>{analyticsData.charts.dailyViews[analyticsData.charts.dailyViews.length - 1]?.date}</span>
                          </div>
                        </div>
                      ) : (
                        <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>Datos de gráfico no disponibles.</p>
                      )}
                    </div>

                    {/* Fuentes de Tráfico */}
                    <div className="panel-card glass-panel" style={{ padding: "24px" }}>
                      <h3 className="panel-title" style={{ marginBottom: "20px", fontSize: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
                        <Globe size={16} />
                        Fuentes de Tráfico (Adquisición)
                      </h3>
                      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        {analyticsData.trafficSources?.map((src: any, idx: number) => (
                          <div key={idx} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                              <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{src.source}</span>
                              <span style={{ color: "var(--text-secondary)" }}>
                                {src.users} ({src.percentage}%)
                              </span>
                            </div>
                            <div style={{ width: "100%", height: "6px", background: "rgba(255,107,0,0.06)", borderRadius: "3px", overflow: "hidden" }}>
                              <div
                                style={{
                                  width: `${src.percentage}%`,
                                  height: "100%",
                                  background: "var(--primary)",
                                  borderRadius: "3px",
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Secondary analytics row (Devices, Countries & Top Read Mangas) */}
                  <div className="panel-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: "20px", marginBottom: "24px" }}>
                    
                    {/* Dispositivos */}
                    <div className="panel-card glass-panel" style={{ padding: "20px" }}>
                      <h3 className="panel-title" style={{ marginBottom: "16px", fontSize: "13px" }}>Dispositivos</h3>
                      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        {analyticsData.devices?.map((dev: any, idx: number) => (
                          <div key={idx} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
                              <span style={{ color: "var(--text-primary)" }}>{dev.device}</span>
                              <span style={{ color: "var(--text-muted)" }}>{dev.percentage}%</span>
                            </div>
                            <div style={{ width: "100%", height: "4px", background: "rgba(255,107,0,0.05)", borderRadius: "2px", overflow: "hidden" }}>
                              <div
                                style={{
                                  width: `${dev.percentage}%`,
                                  height: "100%",
                                  background: dev.device === "Mobile" ? "var(--primary)" : dev.device === "Desktop" ? "var(--accent-blue)" : "var(--accent-green)",
                                  borderRadius: "2px",
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Países */}
                    <div className="panel-card glass-panel" style={{ padding: "20px" }}>
                      <h3 className="panel-title" style={{ marginBottom: "16px", fontSize: "13px" }}>Países Principales</h3>
                      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        {analyticsData.countries?.map((c: any, idx: number) => (
                          <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11px" }}>
                            <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{c.country}</span>
                            <span style={{ color: "var(--text-muted)" }}>{c.users} u. ({c.percentage}%)</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Páginas Más Leídas (Top Mangas/Capítulos) */}
                    <div className="panel-card glass-panel" style={{ padding: "20px", gridColumn: "span 1" }}>
                      <h3 className="panel-title" style={{ marginBottom: "16px", fontSize: "13px" }}>Contenido Más Leído</h3>
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "180px", overflowY: "auto" }}>
                        {analyticsData.topPages?.map((page: any, idx: number) => (
                          <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", borderBottom: "1px solid rgba(255,107,0,0.04)", paddingBottom: "4px" }}>
                            <span
                              style={{
                                color: "var(--primary)",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                maxWidth: "150px",
                              }}
                              title={page.path}
                            >
                              {page.title || page.path}
                            </span>
                            <span style={{ color: "var(--text-muted)" }}>{page.views} vistas</span>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>
                </div>
              )}
            </div>

            {/* Split panels */}
            <div className="panel-grid">
              {/* Online Users List */}
              <div className="panel-card glass-panel">
                <div className="panel-title-row">
                  <h3 className="panel-title">
                    <Globe size={18} className="text-primary" />
                    Presencia y Telemetría de Lectores
                  </h3>
                  <span className="badge badge-green" style={{ fontSize: "9px" }}>Activos ahora</span>
                </div>

                <div className="table-wrapper">
                  {activeUsers.length === 0 ? (
                    <div className="empty-state">
                      <Users size={32} className="empty-state-icon" />
                      <p>No hay lectores navegando en este momento.</p>
                    </div>
                  ) : (
                    <table>
                      <thead>
                        <tr>
                          <th>Usuario / Sesión</th>
                          <th>Página de Lectura</th>
                          <th>Último Ping</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeUsers.map((item) => (
                          <tr key={item.session_id}>
                            <td>
                              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                                <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                                  {item.profiles?.username || "Lector Anónimo"}
                                </span>
                                <span style={{ fontSize: "10px", color: "var(--text-muted)", fontFamily: "monospace" }}>
                                  ID: {item.session_id.substring(0, 8)}...
                                </span>
                              </div>
                            </td>
                            <td>
                              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <span style={{ fontFamily: "monospace", fontSize: "11px", color: "var(--primary)" }}>
                                  {item.path}
                                </span>
                                <a
                                  href={`https://mangastoon.com${item.path}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="action-btn"
                                  title="Ver en vivo"
                                >
                                  <ExternalLink size={12} />
                                </a>
                              </div>
                            </td>
                            <td>
                              {new Date(item.last_active).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Quick broken chapters view */}
              <div className="panel-card glass-panel">
                <div className="panel-title-row">
                  <h3 className="panel-title">
                    <AlertTriangle size={18} className="text-primary" />
                    Alertas Críticas
                  </h3>
                </div>

                <div className="table-wrapper">
                  {brokenChapters.length === 0 ? (
                    <div className="empty-state" style={{ padding: "24px 10px" }}>
                      <CheckCircle size={32} className="empty-state-icon" style={{ color: "var(--accent-green)" }} />
                      <p>¡Todo en orden! Sin capítulos rotos.</p>
                    </div>
                  ) : (
                    <table>
                      <thead>
                        <tr>
                          <th>Cómic / Cap</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {brokenChapters.slice(0, 5).map((ch) => (
                          <tr key={ch.id}>
                            <td>
                              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                                <span style={{ fontWeight: 600, fontSize: "12px", color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "180px" }}>
                                  {ch.manga_title}
                                </span>
                                <span style={{ fontSize: "11px", color: "var(--accent-red)" }}>
                                  Capítulo {ch.chapter_number}
                                </span>
                              </div>
                            </td>
                            <td>
                              <div style={{ display: "flex", gap: "6px" }}>
                                <button
                                  className="action-btn"
                                  title="Marcar como resuelto"
                                  style={{ color: "var(--accent-green)" }}
                                  onClick={() => handleResolveChapter(ch.id)}
                                >
                                  <CheckCircle size={14} />
                                </button>
                                <a
                                  href={`https://mangastoon.com/comics/${ch.manga_id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="action-btn"
                                  title="Ver Manga"
                                >
                                  <ExternalLink size={14} />
                                </a>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
                {brokenChapters.length > 5 && (
                  <button
                    className="btn-secondary"
                    style={{ marginTop: "auto", width: "100%", padding: "10px", fontSize: "11px" }}
                    onClick={() => setActiveTab("broken-chapters")}
                  >
                    Ver todos los reportes ({brokenChapters.length})
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB: BROKEN CHAPTERS ───────────────────────────────────────── */}
        {activeTab === "broken-chapters" && (
          <div className="panel-card glass-panel">
            <div className="panel-title-row">
              <h3 className="panel-title">
                <AlertTriangle size={18} className="text-primary" />
                Listado Completo de Capítulos con Páginas Vacías
              </h3>
              <span className="badge badge-red">{brokenChapters.length} alertas</span>
            </div>

            <div className="table-wrapper">
              {brokenChapters.length === 0 ? (
                <div className="empty-state" style={{ padding: "60px 20px" }}>
                  <CheckCircle size={48} className="empty-state-icon" style={{ color: "var(--accent-green)", marginBottom: "10px" }} />
                  <p style={{ fontWeight: 600, color: "var(--text-primary)" }}>¡Ningún problema detectado!</p>
                  <p style={{ fontSize: "12px" }}>Los lectores no han reportado ni el sistema ha registrado capítulos sin páginas.</p>
                </div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Título del Cómic</th>
                      <th>Capítulo</th>
                      <th>ID de Capítulo (Supabase/MDex)</th>
                      <th>Fecha de Detección</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {brokenChapters.map((ch) => (
                      <tr key={ch.id}>
                        <td>
                          <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{ch.manga_title}</div>
                          <span style={{ fontSize: "10px", color: "var(--text-muted)", fontFamily: "monospace" }}>ID: {ch.manga_id}</span>
                        </td>
                        <td>
                          <span className="badge badge-yellow">Capítulo {ch.chapter_number}</span>
                        </td>
                        <td style={{ fontFamily: "monospace", fontSize: "12px" }}>
                          {ch.chapter_id}
                        </td>
                        <td>
                          {new Date(ch.detected_at).toLocaleString()}
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: "10px" }}>
                            <button
                              className="btn-secondary"
                              style={{ padding: "6px 12px", fontSize: "11px", borderColor: "rgba(16, 185, 129, 0.2)", color: "var(--accent-green)" }}
                              onClick={() => handleResolveChapter(ch.id)}
                            >
                              <CheckCircle size={12} />
                              <span>Resolver</span>
                            </button>
                            <a
                              href={`https://mangastoon.com/comics/${ch.manga_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn-secondary"
                              style={{ padding: "6px 12px", fontSize: "11px" }}
                            >
                              <ExternalLink size={12} />
                              <span>Manga</span>
                            </a>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ─── TAB: FAILED SEARCHES ───────────────────────────────────────── */}
        {activeTab === "failed-searches" && (
          <div className="panel-card glass-panel">
            <div className="panel-title-row">
              <h3 className="panel-title">
                <Search size={18} className="text-primary" />
                Consultas de Búsqueda sin Resultados
              </h3>
              <span className="badge badge-yellow">{failedSearches.length} términos</span>
            </div>

            <div className="table-wrapper">
              {failedSearches.length === 0 ? (
                <div className="empty-state" style={{ padding: "60px 20px" }}>
                  <CheckCircle size={48} className="empty-state-icon" style={{ color: "var(--accent-green)", marginBottom: "10px" }} />
                  <p style={{ fontWeight: 600, color: "var(--text-primary)" }}>¡No hay búsquedas fallidas registradas!</p>
                  <p style={{ fontSize: "12px" }}>Los usuarios han encontrado resultados para todas sus consultas recientes.</p>
                </div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Término Buscado</th>
                      <th>Intentos Fallidos</th>
                      <th>Última Búsqueda</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {failedSearches.map((s) => (
                      <tr key={s.id}>
                        <td>
                          <div style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "14px" }}>&quot;{s.query}&quot;</div>
                        </td>
                        <td>
                          <span className="badge badge-red">{s.count} veces</span>
                        </td>
                        <td>
                          {new Date(s.last_searched).toLocaleString()}
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: "10px" }}>
                            <button
                              className="btn-primary"
                              style={{ padding: "6px 12px", fontSize: "11px" }}
                              onClick={() => handleEnqueueSearch(s.query)}
                            >
                              <Plus size={12} />
                              <span>Mandar al Scraper</span>
                            </button>
                            <button
                              className="btn-secondary"
                              style={{ padding: "6px 12px", fontSize: "11px", borderColor: "rgba(16, 185, 129, 0.2)", color: "var(--accent-green)" }}
                              onClick={() => handleResolveSearch(s.id)}
                            >
                              <CheckCircle size={12} />
                              <span>Resolver</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ─── TAB: COMMENT MODERATION ─────────────────────────────────────── */}
        {activeTab === "comment-moderation" && (
          <div className="panel-card glass-panel">
            <div className="panel-title-row">
              <h3 className="panel-title">
                <MessageSquare size={18} className="text-primary" />
                Comentarios Reportados por la Comunidad
              </h3>
              <span className="badge badge-red">{reportedComments.length} comentarios denunciados</span>
            </div>

            <div className="table-wrapper">
              {reportedComments.length === 0 ? (
                <div className="empty-state" style={{ padding: "60px 20px" }}>
                  <CheckCircle size={48} className="empty-state-icon" style={{ color: "var(--accent-green)", marginBottom: "10px" }} />
                  <p style={{ fontWeight: 600, color: "var(--text-primary)" }}>¡Todo limpio!</p>
                  <p style={{ fontSize: "12px" }}>No hay ningún comentario reportado pendiente de moderación.</p>
                </div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Comentario</th>
                      <th>Autor</th>
                      <th>Ubicación</th>
                      <th>Reportes Recibidos</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportedComments.map((c) => (
                      <tr key={c.id}>
                        <td style={{ maxWidth: "300px" }}>
                          <div style={{ color: "var(--text-primary)", fontWeight: 500, fontSize: "13px", wordBreak: "break-word" }}>
                            &quot;{c.content}&quot;
                          </div>
                          <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>Publicado: {new Date(c.createdAt).toLocaleString()}</span>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, color: "var(--text-secondary)" }}>{c.username}</div>
                        </td>
                        <td>
                          <div style={{ fontSize: "12px" }}>Manga ID: <span style={{ fontFamily: "monospace" }}>{c.mangaId}</span></div>
                          <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>Capítulo: {c.chapterId}</div>
                        </td>
                        <td>
                          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                            {c.reportedWords > 0 && (
                              <span className="badge badge-red" style={{ fontSize: "9px" }}>Lenguaje: {c.reportedWords}</span>
                            )}
                            {c.reportedSpoiler > 0 && (
                              <span className="badge badge-yellow" style={{ fontSize: "9px" }}>Spoiler: {c.reportedSpoiler}</span>
                            )}
                          </div>
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: "10px" }}>
                            <button
                              className="btn-secondary danger"
                              style={{ padding: "6px 12px", fontSize: "11px", border: "1px solid rgba(239, 68, 68, 0.15)", color: "var(--accent-red)", background: "transparent" }}
                              onClick={() => handleDeleteComment(c.id)}
                            >
                              <Trash2 size={12} />
                              <span>Borrar</span>
                            </button>
                            <button
                              className="btn-secondary"
                              style={{ padding: "6px 12px", fontSize: "11px", borderColor: "rgba(16, 185, 129, 0.2)", color: "var(--accent-green)" }}
                              onClick={() => handleDismissReports(c.id)}
                            >
                              <CheckCircle size={12} />
                              <span>Desestimar</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ─── TAB: SCRAPER QUEUE ──────────────────────────────────────────── */}
        {activeTab === "scraper-queue" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "30px" }}>
            {/* Formulario Agregar */}
            <div className="panel-card glass-panel" style={{ maxWidth: "600px" }}>
              <div className="panel-title-row">
                <h3 className="panel-title">
                  <Plus size={18} className="text-primary" />
                  Agregar Manga a la Cola de Extracción
                </h3>
              </div>

              {scraperStatusMsg && (
                <div 
                  className={scraperStatusMsg.includes("con éxito") ? "badge badge-green" : "login-error"} 
                  style={{ marginBottom: "16px", padding: "10px", width: "100%", borderRadius: "var(--radius-sm)", display: "block", textAlign: "center" }}
                >
                  {scraperStatusMsg}
                </div>
              )}

              <form onSubmit={handleEnqueueScrape} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div className="form-group">
                  <label className="form-label">Título del Manga</label>
                  <input
                    type="text"
                    required
                    placeholder="Solo Leveling"
                    value={scraperMangaTitle}
                    onChange={(e) => setScraperMangaTitle(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">URL de Origen (Ej: LeerCapítulo, MangaDex)</label>
                  <input
                    type="url"
                    required
                    placeholder="https://leercapitulo.com/manga/..."
                    value={scraperSourceUrl}
                    onChange={(e) => setScraperSourceUrl(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Prioridad (Mayor valor = más urgente)</label>
                  <select
                    value={scraperPriority}
                    onChange={(e) => setScraperPriority(Number(e.target.value))}
                    style={{
                      background: "var(--bg-tertiary)",
                      border: "1px solid var(--border-color)",
                      color: "var(--text-primary)",
                      padding: "12px",
                      borderRadius: "var(--radius-sm)",
                      outline: "none"
                    }}
                  >
                    <option value={0}>Baja (0)</option>
                    <option value={5}>Media (5)</option>
                    <option value={10}>Alta (10)</option>
                    <option value={20}>Crítica (20)</option>
                  </select>
                </div>
                <button type="submit" className="btn-primary" disabled={scraperLoading} style={{ padding: "12px 20px", width: "fit-content", alignSelf: "flex-end" }}>
                  {scraperLoading ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
                  <span>Agregar a la Cola</span>
                </button>
              </form>
            </div>

            {/* Tabla de la cola */}
            <div className="panel-card glass-panel">
              <div className="panel-title-row">
                <h3 className="panel-title">
                  <Cpu size={18} className="text-primary" />
                  Estado de la Cola del Scraper
                </h3>
                <span className="badge badge-blue">{scraperQueue.length} items</span>
              </div>

              <div className="table-wrapper">
                {scraperQueue.length === 0 ? (
                  <div className="empty-state" style={{ padding: "60px 20px" }}>
                    <Cpu size={48} className="empty-state-icon" style={{ marginBottom: "10px" }} />
                    <p style={{ fontWeight: 600, color: "var(--text-primary)" }}>Cola vacía</p>
                    <p style={{ fontSize: "12px" }}>No hay ninguna tarea de scrapeo programada.</p>
                  </div>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>Manga</th>
                        <th>URL Origen</th>
                        <th>Estado</th>
                        <th>Prioridad</th>
                        <th>Fecha Solicitud</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scraperQueue.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{item.manga_title}</div>
                            {item.error_message && (
                              <span style={{ fontSize: "10px", color: "var(--accent-red)", display: "block", marginTop: "4px" }}>
                                Error: {item.error_message}
                              </span>
                            )}
                          </td>
                          <td style={{ fontSize: "12px", maxWidth: "250px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            <a href={item.source_url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary)", textDecoration: "underline" }}>
                              {item.source_url}
                            </a>
                          </td>
                          <td>
                            <span className={`badge ${
                              item.status === 'completed' ? 'badge-green' :
                              item.status === 'processing' ? 'badge-blue' :
                              item.status === 'failed' ? 'badge-red' : 'badge-yellow'
                            }`}>
                              {item.status === 'completed' ? 'Completado' :
                               item.status === 'processing' ? 'Procesando' :
                               item.status === 'failed' ? 'Fallido' : 'Pendiente'}
                            </span>
                          </td>
                          <td>
                            <span style={{ fontWeight: 700 }}>{item.priority}</span>
                          </td>
                          <td>
                            {new Date(item.requested_at).toLocaleString()}
                          </td>
                          <td>
                            <button
                              className="btn-secondary danger"
                              style={{ padding: "6px 12px", fontSize: "11px", border: "1px solid rgba(239, 68, 68, 0.15)", color: "var(--accent-red)", background: "transparent" }}
                              onClick={() => handleDeleteQueueItem(item.id)}
                            >
                              <Trash2 size={12} />
                              <span>Eliminar</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB: TELEGRAM ANNOUNCEMENTS ─────────────────────────────────── */}
        {activeTab === "telegram" && (
          <div className="panel-card glass-panel" style={{ maxWidth: "700px" }}>
            <div className="panel-title-row">
              <h3 className="panel-title">
                <Send size={18} className="text-primary" />
                Enviar Anuncio Global a la Comunidad
              </h3>
            </div>

            {announcementStatus && (
              <div 
                className={announcementStatus.includes("con éxito") ? "badge badge-green" : "login-error"} 
                style={{ marginBottom: "16px", padding: "10px", width: "100%", borderRadius: "var(--radius-sm)", display: "block", textAlign: "center" }}
              >
                {announcementStatus}
              </div>
            )}

            <form onSubmit={handleSendTelegramAnnouncement} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
              <div style={{ display: "flex", gap: "16px" }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Token del Bot (Secreto)</label>
                  <input
                    type="password"
                    required
                    placeholder="123456789:ABCdefGhIJKlmNoPQRsT..."
                    value={telegramBotToken}
                    onChange={(e) => setTelegramBotToken(e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">ID del Chat (Grupo/Canal)</label>
                  <input
                    type="text"
                    required
                    placeholder="-1003763338725"
                    value={telegramChatId}
                    onChange={(e) => setTelegramChatId(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Mensaje del Anuncio (Soporta Markdown)</label>
                <textarea
                  required
                  rows={8}
                  placeholder="👑 *¡Nuevo Capítulo Disponible!* 👑&#10;&#10;Se ha publicado el capítulo *150* de *Solo Leveling*.&#10;&#10;👉 ¡Ingresá a MangaStoon para leerlo ya! 👈"
                  value={announcementText}
                  onChange={(e) => setAnnouncementText(e.target.value)}
                  style={{
                    background: "var(--bg-tertiary)",
                    border: "1px solid var(--border-color)",
                    color: "var(--text-primary)",
                    padding: "12px",
                    borderRadius: "var(--radius-sm)",
                    outline: "none",
                    resize: "vertical",
                    fontFamily: "inherit",
                    fontSize: "14px"
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                  Usá *texto en negrita* o _cursiva_ de acuerdo a las reglas de Markdown de Telegram.
                </span>
                <button type="submit" className="btn-primary" disabled={announcementLoading} style={{ padding: "12px 24px" }}>
                  {announcementLoading ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                  <span>Enviar Anuncio</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ─── TAB: READERS ────────────────────────────────────────────────── */}
        {activeTab === "readers" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "30px" }}>
            
            <div className="panel-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "30px" }}>
              
              {/* Buscador de Lectores */}
              <div className="panel-card glass-panel" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                <div className="panel-title-row">
                  <h3 className="panel-title">
                    <Search size={18} className="text-primary" />
                    Buscar Lector por Username
                  </h3>
                </div>

                <form onSubmit={handleSearchReaders} style={{ display: "flex", gap: "12px", alignItems: "flex-end" }}>
                  <div className="form-group" style={{ flexGrow: 1 }}>
                    <label className="form-label">Nombre de Usuario (Username)</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: jonasbqz"
                      value={readerSearchQuery}
                      onChange={(e) => setReaderSearchQuery(e.target.value)}
                    />
                  </div>
                  <button type="submit" className="btn-primary" style={{ padding: "12px 20px" }} disabled={searchingReaders}>
                    <Search size={14} />
                    <span>{searchingReaders ? "Buscando..." : "Buscar"}</span>
                  </button>
                </form>

                {readerError && <div className="login-error">{readerError}</div>}

                {/* Tabla de resultados de búsqueda */}
                {readerSearchResults.length > 0 && (
                  <div className="table-wrapper" style={{ marginTop: "16px" }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Usuario</th>
                          <th>Premium</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {readerSearchResults.map((reader) => (
                          <tr key={reader.id} style={{ background: selectedReader?.id === reader.id ? "rgba(255, 107, 0, 0.05)" : "" }}>
                            <td>
                              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                <div className="sidebar-avatar" style={{ margin: 0, width: "28px", height: "28px", fontSize: "10px" }}>
                                  {reader.username ? reader.username.substring(0, 2).toUpperCase() : "US"}
                                </div>
                                <div style={{ display: "flex", flexDirection: "column" }}>
                                  <span style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "13px" }}>{reader.username || "Sin username"}</span>
                                  <span style={{ fontSize: "9px", color: "var(--text-muted)", fontFamily: "monospace" }}>ID: {reader.id.substring(0, 8)}...</span>
                                </div>
                              </div>
                            </td>
                            <td>
                              {reader.is_premium ? (
                                <span className="badge badge-green" style={{ fontSize: "9px" }}>
                                  {reader.premium_type ? reader.premium_type.toUpperCase() : "PREMIUM"}
                                </span>
                              ) : (
                                <span className="badge badge-secondary" style={{ fontSize: "9px", background: "rgba(255,255,255,0.05)", color: "var(--text-muted)" }}>Gratuito</span>
                              )}
                            </td>
                            <td>
                              <button
                                className="btn-secondary"
                                style={{ padding: "6px 12px", fontSize: "11px" }}
                                onClick={() => handleSelectReader(reader)}
                              >
                                Administrar
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Formulario de Administración de Premium */}
              <div className="panel-card glass-panel" style={{ opacity: selectedReader ? 1 : 0.6, pointerEvents: selectedReader ? "auto" : "none" }}>
                <div className="panel-title-row">
                  <h3 className="panel-title">
                    <Users size={18} className="text-primary" />
                    {selectedReader ? `Administrar Premium: ${selectedReader.username || "Lector"}` : "Seleccioná un lector para editar"}
                  </h3>
                </div>

                {selectedReader ? (
                  <form onSubmit={handleUpdateReaderPremium} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                    
                    {readerSuccess && (
                      <div className="badge badge-green" style={{ padding: "10px", width: "100%", borderRadius: "var(--radius-sm)", textTransform: "none" }}>
                        {readerSuccess}
                      </div>
                    )}

                    <div style={{ display: "flex", alignItems: "center", gap: "10px", background: "rgba(255,107,0,0.04)", padding: "12px", borderRadius: "var(--radius-sm)", border: "1px solid rgba(255,107,0,0.08)" }}>
                      <div className="sidebar-avatar" style={{ margin: 0 }}>
                        {selectedReader.username ? selectedReader.username.substring(0, 2).toUpperCase() : "US"}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{selectedReader.username || "Lector"}</span>
                        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>UID: {selectedReader.id}</span>
                      </div>
                    </div>

                    <div className="form-group" style={{ flexDirection: "row", alignItems: "center", gap: "10px" }}>
                      <input
                        type="checkbox"
                        id="is_premium"
                        checked={readerEditPremium}
                        onChange={(e) => setReaderEditPremium(e.target.checked)}
                        style={{ width: "18px", height: "18px", accentColor: "var(--primary)", cursor: "pointer" }}
                      />
                      <label htmlFor="is_premium" style={{ color: "var(--text-primary)", fontWeight: 600, cursor: "pointer", fontSize: "13px" }}>
                        Habilitar Acceso Premium
                      </label>
                    </div>

                    {readerEditPremium && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "16px", background: "rgba(255,255,255,0.02)", padding: "16px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)" }}>
                        <div className="form-group">
                          <label className="form-label">Tipo de Membresía</label>
                          <select
                            value={readerEditPremiumType}
                            onChange={(e) => setReaderEditPremiumType(e.target.value)}
                            style={{ width: "100%", background: "var(--bg-secondary)", border: "1px solid var(--border-color)", padding: "10px", color: "var(--text-primary)", borderRadius: "var(--radius-sm)", outline: "none" }}
                          >
                            <option value="gifted">Regalo (Gifted)</option>
                            <option value="VIP">Suscripción VIP</option>
                            <option value="Gold">Premium Gold</option>
                            <option value="Lifetime">Vitalicio (Lifetime)</option>
                          </select>
                        </div>

                        <div className="form-group">
                          <label className="form-label">Vence el (Expiración)</label>
                          <input
                            type="date"
                            value={readerEditPremiumUntil}
                            onChange={(e) => setReaderEditPremiumUntil(e.target.value)}
                            style={{ width: "100%" }}
                          />
                          <p style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "4px" }}>
                            Dejar vacío si es una cuenta vitalicia / sin fecha de expiración fija.
                          </p>
                        </div>
                      </div>
                    )}

                    <button type="submit" className="btn-primary" style={{ width: "100%", padding: "12px" }}>
                      <span>Guardar Cambios</span>
                    </button>
                  </form>
                ) : (
                  <div className="empty-state" style={{ padding: "40px" }}>
                    <Users size={48} className="empty-state-icon" />
                    <p>Buscá un usuario en el panel izquierdo y hacé clic en "Administrar" para configurar su cuenta.</p>
                  </div>
                )}
              </div>

            </div>

          </div>
        )}

        {/* ─── TAB: TEAM ──────────────────────────────────────────────────── */}
        {activeTab === "team" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "30px" }}>
            
            {/* Promocionar Usuario */}
            <div className="panel-card glass-panel" style={{ maxWidth: "600px" }}>
              <div className="panel-title-row">
                <h3 className="panel-title">
                  <Plus size={18} className="text-primary" />
                  Agregar nuevo Administrador
                </h3>
              </div>

              {teamError && <div className="login-error" style={{ marginBottom: "16px" }}>{teamError}</div>}
              {teamSuccess && <div className="badge badge-green" style={{ marginBottom: "16px", padding: "10px", width: "100%", borderRadius: "var(--radius-sm)" }}>{teamSuccess}</div>}

              <form onSubmit={handleAddAdmin} style={{ display: "flex", gap: "12px", alignItems: "flex-end" }}>
                <div className="form-group" style={{ flexGrow: 1 }}>
                  <label className="form-label">UID de Supabase del Usuario</label>
                  <input
                    type="text"
                    required
                    placeholder="208d7b80-b7cd-4480-82e6-9582431cc78e"
                    value={newAdminId}
                    onChange={(e) => setNewAdminId(e.target.value)}
                  />
                </div>
                <button type="submit" className="btn-primary" style={{ padding: "12px 20px" }}>
                  <Plus size={14} />
                  <span>Promover</span>
                </button>
              </form>
              <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "10px" }}>
                El usuario debe haberse registrado previamente en MangaStoon para poseer una fila en la tabla profiles.
              </p>
            </div>

            {/* Lista de Administradores */}
            <div className="panel-card glass-panel">
              <div className="panel-title-row">
                <h3 className="panel-title">
                  <ShieldCheck size={18} className="text-primary" />
                  Administradores de MangaStoon
                </h3>
                <span className="badge badge-blue">{adminTeam.length} cuentas oficiales</span>
              </div>

              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Avatar</th>
                      <th>Nombre de Usuario</th>
                      <th>UID de Supabase</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminTeam.map((member) => (
                      <tr key={member.id}>
                        <td>
                          <div className="sidebar-avatar" style={{ margin: 0 }}>
                            {member.username ? member.username.substring(0, 2).toUpperCase() : "AD"}
                          </div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                            {member.username || "Sin nombre de usuario"}
                          </div>
                        </td>
                        <td style={{ fontFamily: "monospace", fontSize: "12px" }}>
                          {member.id}
                        </td>
                        <td>
                          {member.id === currentUserProfile?.id ? (
                            <span className="badge badge-blue">Tú (Owner)</span>
                          ) : (
                            <span className="badge badge-green">Administrador</span>
                          )}
                        </td>
                        <td>
                          {member.id !== currentUserProfile?.id && (
                            <button
                              className="btn-secondary danger"
                              style={{ padding: "6px 12px", fontSize: "11px", border: "1px solid rgba(239, 68, 68, 0.15)", color: "var(--accent-red)", background: "rgba(239, 68, 68, 0.02)" }}
                              onClick={() => handleRevokeAdmin(member.id, member.username)}
                            >
                              <Trash2 size={12} />
                              <span>Revocar</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

      </main>
    </div>
  );
}
