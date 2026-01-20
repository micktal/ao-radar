import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function SourcesPage() {
  const supabase = supabaseServer();

  const { data: sources, error } = await supabase
    .from("sources")
    .select("id,name,type,url,is_active,created_at")
    .order("created_at", { ascending: false });

  return (
    <main className="min-h-screen p-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Sources</h1>
          <p className="mt-2 text-sm opacity-80">
            MVP: RSS uniquement (stable). Ajoute/active via Supabase table public.sources.
          </p>
        </div>

        <a className="rounded-md border px-4 py-2 hover:bg-black hover:text-white" href="/dashboard">
          Retour dashboard
        </a>
      </div>

      {error ? (
        <div className="mt-6 rounded-xl border p-5 text-sm">
          <p className="font-semibold">Erreur Supabase</p>
          <p className="mt-2 opacity-80">{error.message}</p>
        </div>
      ) : null}

      <div className="mt-8 overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="border-b bg-gray-50">
            <tr className="text-left">
              <th className="p-3">Actif</th>
              <th className="p-3">Nom</th>
              <th className="p-3">Type</th>
              <th className="p-3">URL</th>
            </tr>
          </thead>

          <tbody>
            {(sources ?? []).map((s) => (
              <tr key={s.id} className="border-b hover:bg-gray-50">
                <td className="p-3">{s.is_active ? "✅" : "—"}</td>
                <td className="p-3 font-medium">{s.name}</td>
                <td className="p-3">{s.type}</td>
                <td className="p-3">
                  <a className="underline" href={s.url} target="_blank" rel="noreferrer">
                    {s.url}
                  </a>
                </td>
              </tr>
            ))}

            {(!sources || sources.length === 0) && (
              <tr>
                <td className="p-6 opacity-70" colSpan={4}>
                  Aucune source. Ajoute une ligne dans Supabase.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-6 rounded-xl border p-5 text-sm opacity-80">
        <p className="font-medium opacity-100">Ajouter une source</p>
        <p className="mt-2">
          Dans Supabase &gt; Table editor &gt; <code>sources</code> :
          <br />
          <span className="opacity-80">
            name: Nom, type: RSS, url: lien RSS, is_active: true
          </span>
        </p>
      </div>
    </main>
  );
}
