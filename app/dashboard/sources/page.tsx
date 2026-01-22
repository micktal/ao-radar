import Link from "next/link";
import { supabaseServer } from "@/lib/supabaseServer";
import SourcesClient from "./SourcesClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SourceRow = {
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
    .order("name", { ascending: true });

  if (error) {
    return (
      <div className="min-h-screen bg-black text-white p-10">
        <div className="text-xl font-bold">Erreur chargement sources</div>
        <div className="text-sm opacity-80 mt-2">{error.message}</div>
      </div>
    );
  }

  const sources = (data ?? []) as SourceRow[];

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto px-6 py-10 space-y-6">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="text-3xl font-bold">Sources</div>
            <div className="text-sm text-slate-300 mt-1">
              Active/Désactive directement ici (sans SQL).
            </div>
          </div>

          <Link
            href="/dashboard"
            className="px-4 py-2 rounded-lg border border-white/30 bg-white/5 hover:bg-white/10"
          >
            Retour dashboard
          </Link>
        </div>

        <SourcesClient initialSources={sources} />
      </div>
    </div>
  );
}
