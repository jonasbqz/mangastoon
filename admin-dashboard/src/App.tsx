import { useEffect, useState } from "react";
import { supabase } from "./supabase";
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
  Globe
} from "lucide-react";
import "./App.css";

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

type ActiveTab = "dashboard" | "broken-chapters" | "team";

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authChecking, setAuthChecking] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>("dashboard");

  // Login Form States
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  // Dashboard Data States
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [brokenChapters, setBrokenChapters] = useState<BrokenChapter[]>([]);
  const [adminTeam, setAdminTeam] = useState<Profile[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Team Management States
  const [newAdminId, setNewAdminId] = useState("");
  const [teamError, setTeamError] = useState<string | null>(null);
  const [teamSuccess, setTeamSuccess] = useState<string | null>(null);

  // 1. Auth Listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        checkAdminStatus(session.user.id);
      } else {
        setAuthChecking(false);
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
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
        // Formateamos para convivir con los tipos de TypeScript
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
    } catch (error) {
      console.error("[FetchData Error]", error);
    } finally {
      setRefreshing(false);
    }
  };

  // Poll data periodically when logged in
  useEffect(() => {
    if (currentUserProfile?.is_admin) {
      fetchData();
      const interval = setInterval(fetchData, 10000); // Polling cada 10 segundos
      return () => clearInterval(interval);
    }
  }, [currentUserProfile]);

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
      });

      if (error) {
        setLoginError(error.message);
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
              <label className="form-label">Contraseña</label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <button type="submit" className="btn-primary" style={{ marginTop: "10px" }} disabled={loginLoading}>
              {loginLoading ? "Accediendo..." : "Iniciar Sesión"}
            </button>
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
              {activeTab === "team" && "Equipo de Administradores"}
            </h1>
            <p className="page-subtitle">
              {activeTab === "dashboard" && "Monitoreo de actividad, telemetría y presencia activa."}
              {activeTab === "broken-chapters" && "Gestión de páginas vacías detectadas en MangaStoon."}
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
