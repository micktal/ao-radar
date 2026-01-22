import Link from "next/link";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";

type Opp = {
  id: string;
  title: string;
  summary: string | null;
  url: string;
  score: number;
  tags: string[];
  status: "NEW" | "TRIAGED" | "QUALIFIED" | "SENT" | "WON" | "LOST";
  published_at: string | null;
  source_family?: string | null;
};

function asText(v: any) {
  return (v ?? "").toString();
}

function toInt(v: any, fallback = 0) {
  const n = Number(v);
  if (Number.isNaN(n)) return fallback;
  return Math.floor(n);
}

function formatDate(v: any) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR");
}

function hasTag(tags: string[], t: string) {
  return Array.isArray(tags) && tags.includes(t);
}

function matchesFamily(tags: string[], family: string) {
  if (family === "ALL") return true;
  if (family === "GARDIENNAGE") return hasTag(tags, "FAM_TELE");
  if (family === "FORMATION") return hasTag(tags, "FAM_FORMATION");
  if (family === "AUDIT") return hasTag(tags, "FAM_AUDIT");

  if (family === "AUTRES") {
    const fams = ["FAM_TELE", "FAM_FORMATION", "FAM_AUDIT"];
    return !(tags || []).some((t) => fams.includes(t));
  }

  return true;
}

function FamilyBadge({ family }: { family: string }) {
  const label =
    family === "GARDIENNAGE"
      ? "Gardiennage"
      : family === "FORMATION"
      ? "Formation"
      : family === "AUDIT"
      ? "Audit"
      : family === "AUTRES"
      ? "Autres"
      : "Toutes";

  return (
    <span className="inline-flex items-center px-3 py-1 rounded-full border border-slate-300 bg-white text-slate-900 text-xs font-medium">
      {label}
    </span>
  );
}

export default async function TodayPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await props.searchParams;

  const q = asText(sp.q || "");
  const minScore = toInt(sp.minScore ?? "30", 30);
  const status = asText(sp.status || "NEW");
  const category = asText(sp.category || "ALL");

  const supabase = supabaseServer();

  const { data: opps, error } = await supabase
    .from("opportunities")
    .select("id,title,summary,url,score,tags,status,published_at,source_family")
    .order("score", { ascending: false })
    .limit(500);

  if (error) {
    return (
      <div className="min-h-screen bg-black text-white p-10">
        <div className="text-xl font-bold">Erreur chargement</div>
        <div className="text-sm opacity-80 mt-2">{error.message}</div>
      </div>
    );
  }

  const list = (opps ?? []) as Opp[];

  const filtered = list.filter((o) => {
    if (o.score < minScore) return false;
    if (status && status !== "ALL" && o.status !== status) return false;
    if (!matchesFamily(o.tags || [], category)) return false;

    if (q) {
      const t = (o.title + " " + (o.summary ?? "")).toLowerCase();
      if (!t.includes(q.toLowerCase())) return false;
    }

    return true;
  });

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto px-6 py-10 space-y-6">
        {/* TOP BAR */}
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="text-3xl font-bold">AO Radar — Aujourd’hui</div>
            <div className="text-sm text-slate-300 mt-1">
              Filtrer → qualifier → transmettre.
            </div>
          </div>

          <div className="flex gap-2">
            <Link
              href="/dashboard"
              className="px-4 py-2 rounded-lg border border-white/30 bg-white/5 hover:bg-white/10"
            >
              Accueil
            </Link>

            <Link
              href="/dashboard/sources"
              className="px-4 py-2 rounded-lg border border-white/30 bg-white/5 hover:bg-white/10"
            >
              Sources
            </Link>
          </div>
        </div>

        {/* FILTERS */}
        <div className="bg-white rounded-xl text-black p-5">
          <form className="grid md:grid-cols-5 gap-4 items-end">
            <div>
              <div className="text-xs font-medium text-slate-600 mb-1">Recherche</div>
              <input
                name="q"
                defaultValue={q}
                placeholder="Titre ou résumé..."
                className="w-full px-3 py-2 rounded-lg border border-slate-300"
              />
            </div>

            <div>
              <div className="text-xs font-medium text-slate-600 mb-1">Score minimum</div>
              <input
                name="minScore"
                defaultValue={String(minScore)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300"
              />
            </div>

            <div>
              <div className="text-xs font-medium text-slate-600 mb-1">Statut</div>
              <select
                name="status"
                defaultValue={status}
                className="w-full px-3 py-2 rounded-lg border border-slate-300"
              >
                <option value="ALL">Tous</option>
                <option value="NEW">Nouveau</option>
                <option value="TRIAGED">Trié</option>
                <option value="QUALIFIED">Qualifié</option>
                <option value="SENT">Transmis</option>
                <option value="WON">Gagné</option>
                <option value="LOST">Perdu</option>
              </select>
            </div>

            <div>
              <div className="text-xs font-medium text-slate-600 mb-1">Je cherche quoi ?</div>
              <select
                name="category"
                defaultValue={category}
                className="w-full px-3 py-2 rounded-lg border border-slate-300"
              >
                <option value="ALL">Toutes</option>
                <option value="GARDIENNAGE">Gardiennage</option>
                <option value="FORMATION">Formation</option>
                <option value="AUDIT">Audit</option>
                <option value="AUTRES">Autres</option>
              </select>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="text-xs text-slate-500">
                {filtered.length} résultats (sur {list.length}) •{" "}
                <FamilyBadge family={category} />
              </div>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-black text-white hover:opacity-90"
              >
                Filtrer
              </button>
            </div>
          </form>
        </div>

        {/* TABLE */}
        <div className="bg-white rounded-xl overflow-hidden">
          <div className="grid grid-cols-12 px-4 py-3 border-b border-slate-200 text-sm font-semibold text-slate-900">
            <div className="col-span-1">Score</div>
            <div className="col-span-6">Opportunité</div>
            <div className="col-span-2">Source</div>
            <div className="col-span-2">Tags</div>
            <div className="col-span-1">Statut</div>
          </div>

          {filtered.length === 0 ? (
            <div className="px-4 py-6 text-sm text-slate-600">
              Aucun résultat avec ces filtres.
            </div>
          ) : (
            filtered.map((o) => (
              <div
                key={o.id}
                className="grid grid-cols-12 px-4 py-4 border-b border-slate-200 text-sm text-slate-900"
              >
                <div className="col-span-1 font-semibold">{o.score}</div>

                <div className="col-span-6">
                  <Link href={`/dashboard/opportunities/${o.id}`} className="font-semibold underline">
                    {o.title}
                  </Link>
                  {o.summary ? (
                    <div className="text-slate-600 mt-1 line-clamp-2">{o.summary}</div>
                  ) : null}
                  <div className="text-xs text-slate-400 mt-1">Publié : {formatDate(o.published_at)}</div>
                </div>

                <div className="col-span-2">
                  <span className="inline-flex items-center px-2 py-1 rounded-full border border-slate-300 bg-white text-slate-900 text-xs">
                    {o.source_family ?? "—"}
                  </span>
                </div>

                <div className="col-span-2 flex flex-wrap gap-2">
                  {(o.tags || []).slice(0, 4).map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center px-2 py-1 rounded-full border border-slate-300 bg-white text-slate-900 text-xs"
                    >
                      {t}
                    </span>
                  ))}
                </div>

                <div className="col-span-1 font-medium">{o.status}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
