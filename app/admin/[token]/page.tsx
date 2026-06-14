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
    "demon";

  if (token !== adminToken) {
    notFound();
  }

  return <AdminClient />;
}
