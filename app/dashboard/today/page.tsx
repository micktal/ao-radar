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
  assigned_to: string | null;
  priority: "LOW" | "NORMAL" | "HIGH" | null;
  note: string | null;
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

const inputClass =
  "mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-black placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black";

export default function TodayPage() {
  const supabase = supabaseBrowser();

  const [rows, setRows] = useState<Opp[]>([]);
  const [loading, setLoading] = useState(true);
  const [minScore, setMinScore] = useState(40);

  async function load() {
    setLoading(true);

    const { data } = await supabase
      .from("opportunities")
      .select("id,title,url,published_at,score,tags,status,summary,assigned_to,priority,note,created_at")
      .eq("status", "NEW")
      .order("score", { ascending: false })
      .limit(300);

    setRows((data ?? []) as Opp[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((r) => r.score >= minScore);
  }, [rows, minScore]);

  return (
    <main className="min-h-screen p-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">À traiter aujourd’hui</h1>
          <p className="mt-2 text-sm opacity-80">
            Liste de travail alternants (statut = Nouveau) triée par score.
          </p>
        </div>

        <div className="flex gap-2">
          <a className="rounded-md border px-4 py-2 hover:bg-black hover:text-white" href="/dashboard">
            Dashboard
          </a>
          <a className="rounded-md border px-4 py-2 hover:bg-black hover:text-white" href="/dashboard/sources">
            Sources
          </a>
        </div>
      </div>

      <div className="mt-6 rounded-xl border bg-white p-4 text-black">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="max-w-sm">
            <label className="text-xs text-gray-600">Score minimum</label>
            <input
              type="number"
              className={inputClass}
              value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value))}
            />
          </div>

          <div className="flex gap-2">
            <a
              className="rounded-md border px-3 py-2 text-sm hover:bg-black hover:text-white"
              href={`/api/opportunities/export?minScore=${minScore}&status=NEW`}
            >
              Export CSV
            </a>

            <button
              onClick={load}
              className="rounded-md border px-3 py-2 text-sm hover:bg-black hover:text-white"
            >
              Actualiser
            </button>
          </div>
        </div>

        <div className="mt-3 text-xs text-gray-600">
          {loading ? "Chargement…" : `${filtered.length} opportunités à traiter (sur ${rows.length})`}
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-sm text-black">
          <thead className="border-b bg-gray-100">
            <tr className="text-left">
              <th className="p-3 font-semibold">Score</th>
              <th className="p-3 font-semibold">Opportunité</th>
              <th className="p-3 font-semibold">Tags</th>
              <th className="p-3 font-semibold">Statut</th>
              <th className="p-3 font-semibold">Fiche</th>
            </tr>
          </thead>

          <tbody>
            {filtered.map((o) => (
              <tr key={o.id} className="border-b hover:bg-gray-50 align-top">
                <td className="p-3 font-semibold">{o.score}</td>

                <td className="p-3">
                  <a className="font-medium underline" href={o.url} target="_blank" rel="noreferrer">
                    {o.title}
                  </a>

                  {o.summary ? <div className="mt-2 max-w-3xl text-xs text-gray-600">{o.summary}</div> : null}

                  <div className="mt-2 text-xs text-gray-600">
                    {o.published_at ? `Publié : ${new Date(o.published_at).toLocaleString()}` : "Publié : -"}
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

                <td className="p-3">{STATUS_LABELS[o.status]}</td>

                <td className="p-3">
                  <a
                    className="inline-block rounded-md border px-3 py-2 text-xs hover:bg-black hover:text-white"
                    href={`/dashboard/opportunities/${o.id}`}
                  >
                    Ouvrir la fiche
                  </a>
                </td>
              </tr>
            ))}

            {!loading && filtered.length === 0 ? (
              <tr>
                <td className="p-6 text-gray-600" colSpan={5}>
                  Rien à traiter avec ce score.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </main>
  );
}
