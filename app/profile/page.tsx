import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getProfile } from "../actions/profile";
import SiteHeader, { type SupportedLanguage } from "../components/site-header";
import ProfileForm from "./ProfileForm";

export const metadata = {
  title: "Mi Perfil — Mangastoon",
  robots: {
    index: false,
    follow: false,
  },
};

function normalizeLanguage(value: string | undefined): SupportedLanguage {
  if (value === "en" || value === "pt") return value;
  return "es";
}

const PROFILE_COPY: Record<SupportedLanguage, { title: string; subtitle: string; lockNotice: string }> = {
  es: {
    title: "Mi Perfil",
    subtitle: "Gestioná tu información personal",
    lockNotice: "El nombre de usuario solo puede cambiarse una vez cada 7 días.",
  },
  en: {
    title: "My Profile",
    subtitle: "Manage your personal information",
    lockNotice: "Username can only be changed once every 7 days.",
  },
  pt: {
    title: "Meu Perfil",
    subtitle: "Gerencie suas informações pessoais",
    lockNotice: "O nome de usuário só pode ser alterado uma vez a cada 7 dias.",
  },
};

export default async function ProfilePage() {
  const data = await getProfile();

  if (!data) {
    redirect("/");
  }

  const { user, profile } = data;
  const cookieStore = await cookies();
  const languagePreference = cookieStore.get("lang")?.value;
  const currentLanguage = normalizeLanguage(languagePreference);
  const copy = PROFILE_COPY[currentLanguage];

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader language={currentLanguage} />
      
      <main className="flex-1 px-4 pt-8 pb-28 md:py-12 flex items-center justify-center">
        <div className="w-full max-w-lg">
          {/* Header */}
          <div className="mb-8">
            <h1
              className="text-2xl font-bold tracking-tight"
              style={{ color: "#f7f2e8", fontFamily: "var(--font-heading), sans-serif" }}
            >
              {copy.title}
            </h1>
            <p className="mt-1 text-sm" style={{ color: "rgba(194,184,166,0.55)" }}>
              {copy.subtitle}
            </p>
          </div>

          {/* Card */}
          <div
            className="rounded-2xl p-4 sm:p-6"
            style={{
              background: "#131110",
              border: "1px solid rgba(247,242,232,0.10)",
              boxShadow: "0 24px 48px rgba(0,0,0,0.4)",
            }}
          >
            <ProfileForm
              profile={profile}
              user={{
                id: user.id,
                email: user.email,
                app_metadata: user.app_metadata as { provider?: string },
                user_metadata: user.user_metadata as { scheduled_delete_at?: string | null; premium_since?: string | null },
                created_at: user.created_at,
              }}
            />
          </div>

          {/* Nota sobre el bloqueo */}
          <p className="mt-4 text-center text-xs" style={{ color: "rgba(194,184,166,0.35)" }}>
            {copy.lockNotice}
          </p>
        </div>
      </main>
    </div>
  );
}
