"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

type Opp = {
  id: string;
  title: string;
  url: string;
  published_at: string | null;
  score: number;
  tags: string[];
  status: "NEW" | "TRIAGED" | "QUALIFIED" | "SENT" | "WON" | "LOST";
  summary: string | null;
  created_at: string;
};

const STATUS_LABELS: Record<Opp["status"], string> = {
  NEW: "Nouveau",
  TRIAGED: "Trié",
  QUALIFIED: "Qualifié",
  SENT: "Transmis",
  WON: "Gagné",
  LOST: "Perdu",
};

const TAG_LABELS: Record<string, string> = {
  TELESURVEILLANCE: "Télésurveillance",
  VIDEO: "Vidéoprotection",
  AUDIT_SECURITE: "Audit sécurité",
  FORMATION: "Formation",
  APPEL_OFFRE: "Appel d’offres",
  EXIGENCES: "Exigences",
  HSE: "HSE",
};

const STATUSES: Opp["status"][] = ["NEW", "TRIAGED", "QUALIFIED", "SENT", "WON", "LOST"];

// ✅ Inputs/selects = blanc + texte noir (lisible)
const inputClass =
  "mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-black placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black";
const selectClass =
  "mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-black";

export default function DashboardClient() {
  const supabase = supabaseBrowser();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Opp[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [q, setQ] = useState("");
  const [minScore, setMinScore] = useState(30);
  const [status, setStatus] = useState<Opp["status"] | "ALL">("NEW");
  const [tag, setTag] = useState<string | "ALL">("ALL");

  const allTags = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => (r.tags ?? []).forEach((t) => set.add(t)));
    const list = Array.from(set).sort();
    return ["ALL", ...list];
  }, [rows]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();

    return rows
      .filter((r) => r.score >= minScore)
      .filter((r) => (status === "ALL" ? true : r.status === status))
      .filter((r) => (tag === "ALL" ? true : (r.tags ?? []).includes(tag)))
      .filter((r) => {
        if (!s) return true;
        return (r.title ?? "").toLowerCase().includes(s) || (r.summary ?? "").toLowerCase().includes(s);
      })
      .sort((a, b) => b.score - a.score);
  }, [rows, q, minScore, status, tag]);

  const kpis = useMemo(() => {
    const total = rows.length;
    const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<Opp["status"], number>;
    rows.forEach((r) => (byStatus[r.status] = (byStatus[r.status] ?? 0) + 1));

    return {
      total,
      NEW: byStatus.NEW,
      QUALIFIED: byStatus.QUALIFIED,
      SENT: byStatus.SENT,
      WON: byStatus.WON,
      LOST: byStatus.LOST,
      TRIAGED: byStatus.TRIAGED,
    };
  }, [rows]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from("opportunities")
        .select("id,title,url,published_at,score,tags,status,summary,created_at")
        .order("created_at", { ascending: false })
        .limit(800);

      if (error) throw error;

      setRows((data ?? []) as Opp[]);
    } catch (e: any) {
      setError(e?.message ?? "Erreur");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function setRowStatus(id: string, newStatus: Opp["status"]) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r)));

    const res = await fetch("/api/opportunities/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: newStatus }),
    });

    if (!res.ok) {
      await load();
      alert("Erreur : mise à jour du statut impossible.");
    }
  }

  return (
    <main className="min-h-screen p-8">
      {/* Header */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">AO Radar — Dashboard</h1>
          <p className="mt-2 text-sm opacity-80">
            Travail alternants : filtrer → qualifier → transmettre.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <a className="rounded-md border px-4 py-2 hover:bg-black hover:text-white" href="/dashboard/today">
            Aujourd’hui
          </a>
          <a className="rounded-md border px-4 py-2 hover:bg-black hover:text-white" href="/">
            Accueil
          </a>
          <a className="rounded-md border px-4 py-2 hover:bg-black hover:text-white" href="/dashboard/sources">
            Sources
          </a>
        </div>
      </div>

      {/* KPI Cards (blanches) */}
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-6">
        <KpiCard label="Total" value={kpis.total} />
        <KpiCard label="À traiter" value={kpis.NEW} />
        <KpiCard label="Qualifiés" value={kpis.QUALIFIED} />
        <KpiCard label="Transmis" value={kpis.SENT} />
        <KpiCard label="Gagnés" value={kpis.WON} />
        <KpiCard label="Perdus" value={kpis.LOST} />
      </div>

      {/* Filters (bloc blanc) */}
      <div className="mt-6 rounded-xl border bg-white p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div>
            <label className="text-xs text-gray-600">Recherche</label>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Titre ou résumé…"
              className={inputClass}
            />
          </div>

          <div>
            <label className="text-xs text-gray-600">Score minimum</label>
            <input
              type="number"
              value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value))}
              className={inputClass}
            />
          </div>

          <div>
            <label className="text-xs text-gray-600">Statut</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as any)} className={selectClass}>
              <option value="ALL">Tous</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-600">Catégorie</label>
            <select value={tag} onChange={(e) => setTag(e.target.value)} className={selectClass}>
              <option value="ALL">Toutes</option>
              {allTags
                .filter((t) => t !== "ALL")
                .map((t) => (
                  <option key={t} value={t}>
                    {TAG_LABELS[t] ?? t}
                  </option>
                ))}
            </select>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <div className="text-xs text-gray-600">
            {loading ? "Chargement..." : `${filtered.length} résultats (sur ${rows.length})`}
          </div>

          <button
            onClick={load}
            className="rounded-md border px-3 py-2 text-sm hover:bg-black hover:text-white"
          >
            Actualiser
          </button>
        </div>
      </div>

      {error ? (
        <div className="mt-6 rounded-xl border bg-white p-5 text-sm">
          <p className="font-semibold text-black">Erreur</p>
          <p className="mt-2 text-gray-600">{error}</p>
        </div>
      ) : null}

      {/* Table (bloc blanc) */}
      <div className="mt-6 overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-sm text-black">
          <thead className="border-b bg-gray-100 text-black">
            <tr className="text-left">
              <th className="p-3 font-semibold">Score</th>
              <th className="p-3 font-semibold">Opportunité</th>
              <th className="p-3 font-semibold">Tags</th>
              <th className="p-3 font-semibold">Statut</th>
              <th className="p-3 font-semibold">Actions</th>
            </tr>
          </thead>

          <tbody>
            {filtered.map((o) => (
              <tr key={o.id} className="border-b hover:bg-gray-50 align-top">
                <td className="p-3 font-semibold">{o.score}</td>

                <td className="p-3">
                  <a className="font-medium underline" href={`/dashboard/opportunities/${o.id}`}>
                    {o.title}
                  </a>

                  {o.summary ? <div className="mt-2 max-w-3xl text-xs text-gray-600">{o.summary}</div> : null}

                  <div className="mt-2 text-xs text-gray-600">
                    {o.published_at ? `Publié : ${new Date(o.published_at).toLocaleString()}` : "Publié : -"}
                  </div>

                  <div className="mt-2">
                    <a
                      className="inline-block rounded-md border px-3 py-1 text-xs hover:bg-black hover:text-white"
                      href={`/dashboard/opportunities/${o.id}`}
                    >
                      Ouvrir la fiche
                    </a>
                  </div>
                </td>

                <td className="p-3">
                  <div className="flex flex-wrap gap-2">
                    {(o.tags ?? []).map((t) => (
                      <span key={t} className="rounded-full border px-2 py-1 text-xs">
                        {TAG_LABELS[t] ?? t}
                      </span>
                    ))}
                  </div>
                </td>

                <td className="p-3 font-medium">{STATUS_LABELS[o.status]}</td>

                <td className="p-3">
                  <div className="flex flex-wrap gap-2">
                    <ActionBtn onClick={() => setRowStatus(o.id, "QUALIFIED")} label="Qualifier" />
                    <ActionBtn onClick={() => setRowStatus(o.id, "SENT")} label="Transmettre" />
                    <ActionBtn onClick={() => setRowStatus(o.id, "WON")} label="Gagné" />
                    <ActionBtn onClick={() => setRowStatus(o.id, "LOST")} label="Perdu" />
                  </div>
                </td>
              </tr>
            ))}

            {!loading && filtered.length === 0 ? (
              <tr>
                <td className="p-6 text-gray-600" colSpan={5}>
                  Aucun résultat avec ces filtres.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </main>
  );
}

function KpiCard(props: { label: string; value: number }) {
  return (
    <div className="rounded-xl border bg-white p-3 text-black">
      <div className="text-xs text-gray-600">{props.label}</div>
      <div className="mt-1 text-2xl font-semibold">{props.value}</div>
    </div>
  );
}

function ActionBtn(props: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={props.onClick}
      className="rounded-md border px-3 py-2 text-xs hover:bg-black hover:text-white"
    >
      {props.label}
    </button>
  );
}
