"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

type Opp = {
  id: string;
  title: string;
  url: string;
  published_at: string | null;
  score: number;
  tags: string[];
  status: "NEW" | "TRIAGED" | "QUALIFIED" | "SENT" | "WON" | "LOST";
  summary: string | null;
  raw: string | null;
  created_at: string;

  assigned_to: string | null;
  priority: "LOW" | "NORMAL" | "HIGH" | null;
  note: string | null;
};

const STATUS_LABELS: Record<Opp["status"], string> = {
  NEW: "Nouveau",
  TRIAGED: "Trié",
  QUALIFIED: "Qualifié",
  SENT: "Transmis",
  WON: "Gagné",
  LOST: "Perdu",
};

const PRIORITY_LABELS: Record<NonNullable<Opp["priority"]>, string> = {
  LOW: "Faible",
  NORMAL: "Normale",
  HIGH: "Haute",
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
const selectClass =
  "mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-black";
const textareaClass =
  "mt-1 w-full min-h-[120px] rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-black placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black";

function extractKeyPoints(text: string) {
  const t = (text || "").toLowerCase();
  const picks: string[] = [];

  if (/(télésurveillance|telesurveillance|remote monitoring)/i.test(t)) picks.push("Sujet : Télésurveillance / supervision");
  if (/(audit\s+sécurité|audit\s+sûreté|security audit)/i.test(t)) picks.push("Sujet : Audit sécurité / sûreté");
  if (/(formation|e-learning|distanciel|présentiel|sst|incendie)/i.test(t)) picks.push("Sujet : Formation / e-learning");
  if (/(appel d['’]offre|consultation|tender|rfp|marché public)/i.test(t)) picks.push("Type : Appel d’offres / consultation");
  if (/(cnaps|apsad|iso|mase|ssi)/i.test(t)) picks.push("Exigences : conformité / certifications mentionnées");
  if (/(date limite|deadline|remise des offres|closing date)/i.test(t)) picks.push("Important : une date limite est mentionnée (à vérifier)");

  return picks.slice(0, 6);
}

function buildEmailText(o: Opp) {
  const tags = (o.tags ?? []).map((t) => TAG_LABELS[t] ?? t).join(", ");
  const published = o.published_at ? new Date(o.published_at).toLocaleString() : "-";

  return `Bonjour,

Je te transfère une opportunité détectée via AO Radar.

TITRE :
${o.title}

SCORE :
${o.score}/100

CATEGORIE / TAGS :
${tags || "-"}

STATUT :
${STATUS_LABELS[o.status]}

DATE (publication) :
${published}

LIEN SOURCE :
${o.url}

RESUME :
${o.summary ?? "-"}

NOTE ALTERNANT :
${o.note ?? "-"}

Assigné à : ${o.assigned_to ?? "-"}
Priorité : ${o.priority ? PRIORITY_LABELS[o.priority] : "-"}

Merci,
`;
}

export default function OpportunityDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [opp, setOpp] = useState<Opp | null>(null);

  // form fields
  const [assignedTo, setAssignedTo] = useState<string>("");
  const [priority, setPriority] = useState<Opp["priority"]>("NORMAL");
  const [note, setNote] = useState<string>("");

  const points = useMemo(() => {
    if (!opp) return [];
    return extractKeyPoints(`${opp.title}\n${opp.summary ?? ""}\n${opp.raw ?? ""}`);
  }, [opp]);

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/opportunities/get?id=${encodeURIComponent(id)}`);
      if (!res.ok) throw new Error("Impossible de charger l’opportunité");

      const json = await res.json();
      setOpp(json.data as Opp);

      setAssignedTo((json.data?.assigned_to ?? "") as string);
      setPriority(((json.data?.priority ?? "NORMAL") as Opp["priority"]) ?? "NORMAL");
      setNote((json.data?.note ?? "") as string);
    } catch (e: any) {
      setError(e?.message ?? "Erreur");
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    if (!opp) return;

    const res = await fetch("/api/opportunities/update-details", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: opp.id,
        assigned_to: assignedTo.trim() ? assignedTo.trim() : null,
        priority: priority ?? "NORMAL",
        note: note.trim() ? note.trim() : null,
      }),
    });

    if (!res.ok) {
      alert("Erreur : impossible d’enregistrer.");
      return;
    }

    alert("Enregistré ✅");
    await load();
  }

  async function copyEmail() {
    if (!opp) return;
    const text = buildEmailText({ ...opp, assigned_to: assignedTo || null, priority, note: note || null });
    await navigator.clipboard.writeText(text);
    alert("Mail copié ✅ (colle-le dans Outlook/Gmail)");
  }

  useEffect(() => {
    if (id) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return (
    <main className="min-h-screen p-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Fiche Opportunité</h1>
          <p className="mt-2 text-sm opacity-80">Qualification + transmission commerciale.</p>
        </div>

        <div className="flex gap-2">
          <a className="rounded-md border px-4 py-2 hover:bg-black hover:text-white" href="/dashboard">
            Retour dashboard
          </a>
          {opp?.url ? (
            <a
              className="rounded-md border px-4 py-2 hover:bg-black hover:text-white"
              href={opp.url}
              target="_blank"
              rel="noreferrer"
            >
              Ouvrir la source
            </a>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="mt-8 rounded-xl border bg-white p-5 text-sm text-gray-600">Chargement…</div>
      ) : null}

      {error ? (
        <div className="mt-8 rounded-xl border bg-white p-5 text-sm">
          <div className="font-semibold text-black">Erreur</div>
          <div className="mt-2 text-gray-600">{error}</div>
        </div>
      ) : null}

      {!loading && opp ? (
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* MAIN */}
          <div className="lg:col-span-2 rounded-xl border bg-white p-5 text-black">
            <div className="text-xs text-gray-600">Titre</div>
            <div className="mt-1 text-xl font-semibold">{opp.title}</div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <Info label="Score" value={`${opp.score}`} />
              <Info label="Statut" value={STATUS_LABELS[opp.status]} />
              <Info label="Publié" value={opp.published_at ? new Date(opp.published_at).toLocaleString() : "-"} />
              <Info label="Créé" value={new Date(opp.created_at).toLocaleString()} />
            </div>

            <div className="mt-4">
              <div className="text-xs text-gray-600">Résumé</div>
              <div className="mt-2 text-sm leading-relaxed text-gray-700">{opp.summary ?? "—"}</div>
            </div>

            <div className="mt-6">
              <div className="text-xs text-gray-600">Tags</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {(opp.tags ?? []).map((t: string) => (
                  <span key={t} className="rounded-full border px-2 py-1 text-xs">
                    {TAG_LABELS[t] ?? t}
                  </span>
                ))}
                {(!opp.tags || opp.tags.length === 0) && <span className="text-xs text-gray-600">—</span>}
              </div>
            </div>

            <div className="mt-6">
              <div className="text-xs text-gray-600">Texte brut (référence)</div>
              <pre className="mt-2 max-h-[320px] overflow-auto rounded-lg border bg-gray-50 p-3 text-xs leading-relaxed text-gray-800">
{opp.raw ?? "—"}
              </pre>
            </div>
          </div>

          {/* SIDE */}
          <div className="rounded-xl border bg-white p-5 text-black">
            <div className="text-sm font-semibold">Qualification alternant</div>

            <div className="mt-4">
              <label className="text-xs text-gray-600">Assigné à</label>
              <input
                className={inputClass}
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                placeholder="Nom alternant / équipe…"
              />
            </div>

            <div className="mt-4">
              <label className="text-xs text-gray-600">Priorité</label>
              <select className={selectClass} value={priority ?? "NORMAL"} onChange={(e) => setPriority(e.target.value as any)}>
                <option value="LOW">Faible</option>
                <option value="NORMAL">Normale</option>
                <option value="HIGH">Haute</option>
              </select>
            </div>

            <div className="mt-4">
              <label className="text-xs text-gray-600">Note / commentaire</label>
              <textarea
                className={textareaClass}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ce qui est important, points à vérifier, contact, deadline…"
              />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={save} className="rounded-md border px-4 py-2 text-sm hover:bg-black hover:text-white">
                Enregistrer
              </button>

              <button onClick={copyEmail} className="rounded-md border px-4 py-2 text-sm hover:bg-black hover:text-white">
                Transmettre (copier mail)
              </button>
            </div>

            <div className="mt-6">
              <div className="text-sm font-semibold">Points clés détectés</div>
              <ul className="mt-3 space-y-2 text-sm">
                {points.length > 0 ? (
                  points.map((p, i) => (
                    <li key={i} className="rounded-md border px-3 py-2 text-gray-800">
                      {p}
                    </li>
                  ))
                ) : (
                  <li className="text-sm text-gray-600">Aucun point clé détecté.</li>
                )}
              </ul>
            </div>

            <div className="mt-6 text-xs text-gray-600">
              ✅ Objectif : un alternant prépare une transmission claire en moins de 2 minutes.
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function Info(props: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-white p-3">
      <div className="text-xs text-gray-600">{props.label}</div>
      <div className="mt-1 font-medium text-black">{props.value}</div>
    </div>
  );
}
