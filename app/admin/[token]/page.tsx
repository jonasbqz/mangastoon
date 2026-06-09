import { notFound } from "next/navigation";
import AdminClient from "./AdminClient";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function AdminPage({ params }: PageProps) {
  const { token } = await params;
  
  const adminToken =
    process.env.NEXT_PUBLIC_ADMIN_TOKEN ||
    process.env.ADMIN_TOKEN ||
    "control-secreto-2026";

  console.log("DEBUG ADMIN ROUTE:", { token, adminToken });

  if (token !== adminToken) {
    return (
      <div style={{ padding: "100px", color: "white", background: "black" }}>
        <h1>DEBUG ADMIN TOKEN</h1>
        <p>token recibido: &quot;{token}&quot;</p>
        <p>token esperado: &quot;{adminToken}&quot;</p>
      </div>
    );
  }

  return <AdminClient />;
}
