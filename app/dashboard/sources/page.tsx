import { supabaseServer } from "@/lib/supabaseServer";
import SourcesClient from "./SourcesClient";

export const runtime = "nodejs";

type Source = {
  id: string;
  name: string;
  type: "RSS" | "API";
  url: string;
  is_active: boolean;
};

export default async function SourcesPage() {
  const supabase = supabaseServer();

  const { data, error } = await supabase
    .from("sources")
    .select("id,name,type,url,is_active")
    .order("type", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    return (
      <div className="min-h-screen bg-black text-white p-10">
        <div className="text-xl font-bold">Erreur chargement</div>
        <div className="text-sm opacity-80 mt-2">{error.message}</div>
      </div>
    );
  }

  return <SourcesClient sources={(data ?? []) as Source[]} />;
}
