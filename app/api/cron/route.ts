import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";

type Source = {
  id: string;
  name: string;
  type: "RSS" | "API";
  url: string;
  is_active: boolean;
};

const CPV_CODES = [
  "79711000",
  "79710000",
  "45312000",
  "50610000",
  "35120000",
  "71317100",
  "79417000",
  "71317000",
  "80550000",
  "80561000",
];

function normalizeText(v: any) {
  return (v ?? "").toString().trim();
}

function extractCpvCodes(record: any): string[] {
  const out: string[] = [];

  if (record?.cpv) {
    if (Array.isArray(record.cpv)) out.push(...record.cpv.map((x: any) => normalizeText(x)));
    else out.push(normalizeText(record.cpv));
  }

  const raw = JSON.stringify(record);

  const matches = raw.match(/"cpv"[^0-9]{0,60}([0-9]{8})/gi) ?? [];
  for (const m of matches) {
    const n = m.match(/([0-9]{8})/)?.[1];
    if (n) out.push(n);
  }

  const matches2 =
    raw.match(/"@listName"\s*:\s*"cpv"[\s\S]{0,200}?"#text"\s*:\s*"([0-9]{8})"/gi) ?? [];
  for (const m of matches2) {
    const n = m.match(/"([0-9]{8})"/)?.[1];
    if (n) out.push(n);
  }

  return Array.from(new Set(out.filter(Boolean)));
}

function hasAllowedCPV(cpvList: string[]) {
  return cpvList.some((cpv) => CPV_CODES.some((allowed) => cpv.startsWith(allowed)));
}

/**
 * ✅ Tags demandés :
 * - CPV contient 7971 => GARDIENNAGE
 * - CPV contient 805 => FORMATION
 * - sinon => skip
 */
function tagsFromCPV(cpvList: string[]) {
  const joined = cpvList.join(" ");
  if (/(^|[^0-9])7971/i.test(joined)) return ["FAM_TELE", "GARDIENNAGE"];
  if (/(^|[^0-9])805/i.test(joined)) return ["FAM_FORMATION", "FORMATION"];
  return [];
}

function scoreFromCPV(cpvList: string[]) {
  const joined = cpvList.join(" ");
  if (/(^|[^0-9])7971/i.test(joined)) return 80;
  if (/(^|[^0-9])805/i.test(joined)) return 75;
  return 60;
}

function detectSourceFamily(source: Source) {
  const n = (source.name || "").toUpperCase();
  const u = (source.url || "").toLowerCase();

  if (n.includes("BOAMP") || u.includes("/datasets/boamp/")) return "BOAMP";
  if (n.includes("JOUE") || n.includes("TED") || u.includes("/datasets/joue/")) return "JOUE";

  return null;
}

async function upsertOpportunity(params: {
  title: string;
  url: string;
  published_at?: string | null;
  summary?: string | null;
  raw?: any;
  score: number;
  tags: string[];
  source_family?: string | null;
}) {
  const supabase = supabaseServer();

  const { data: existing } = await supabase.from("opportunities").select("id").eq("url", params.url).maybeSingle();
  if (existing?.id) return { created: false };

  const payload: any = {
    title: params.title,
    url: params.url,
    published_at: params.published_at ?? null,
    summary: params.summary ?? null,
    raw: params.raw ? JSON.stringify(params.raw) : null,
    score: params.score,
    tags: params.tags ?? [],
    status: "NEW",
  };

  if (params.source_family) payload.source_family = params.source_family;

  const { error } = await supabase.from("opportunities").insert(payload);
  if (error) throw error;

  return { created: true };
}

function getDateValue(r: any) {
  const v = r?.dateparution || r?.datepublication || r?.date || r?.date_joue || null;
  if (!v) return 0;
  const t = new Date(v).getTime();
  return Number.isNaN(t) ? 0 : t;
}

/**
 * ✅ FETCH ULTRA SAFE :
 * - on NE TOUCHER PAS aux params (aucun limit/order_by)
 * - on fait tout localement
 * - on sort le body complet en cas de 400
 */
async function ingestOpenDataSoftUltraSafe(source: Source) {
  const finalUrl = source.url; // ✅ zéro paramètre ajouté

  const res = await fetch(finalUrl, {
    method: "GET",
    cache: "no-store",
    headers: {
      "accept": "application/json",
    },
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`OpenDataSoft fetch failed (${res.status}) URL=${finalUrl} BODY=${t}`);
  }

  const json = await res.json();
  let results = (json?.results ?? []) as any[];

  // ✅ tri local (dernier -> ancien)
  results.sort((a, b) => getDateValue(b) - getDateValue(a));

  // ✅ limit local (pour perf)
  results = results.slice(0, 400);

  let created = 0;

  for (const r of results) {
    const cpvList = extractCpvCodes(r);
    if (!hasAllowedCPV(cpvList)) continue;

    const tags = tagsFromCPV(cpvList);
    if (!tags.length) continue;

    const title = normalizeText(r?.intitule || r?.objet || r?.titre || r?.libelle || "Opportunité");
    const pub = normalizeText(r?.dateparution || r?.datepublication || r?.date || r?.date_joue || "");
    const summary = normalizeText(r?.objet || r?.description || r?.resume || "");

    const link =
      normalizeText(r?.url_avis || r?.url_ted || r?.url || r?.lien || r?.source || "") ||
      `${source.url}?ref=${encodeURIComponent(normalizeText(r?.idweb || r?.id || r?.reference_ted || title))}`;

    const score = scoreFromCPV(cpvList);
    const source_family = detectSourceFamily(source);

    const out = await upsertOpportunity({
      title,
      url: link,
      published_at: pub ? new Date(pub).toISOString() : null,
      summary: summary ? summary.slice(0, 600) : null,
      raw: { ...r, __cpv: cpvList },
      score,
      tags,
      source_family,
    });

    if (out.created) created++;
  }

  return { created, url: finalUrl };
}

export async function GET(req: Request) {
  const secret = new URL(req.url).searchParams.get("secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = supabaseServer();

  const { data: sources, error } = await supabase
    .from("sources")
    .select("id,name,type,url,is_active")
    .eq("is_active", true)
    .eq("type", "API");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let totalCreated = 0;
  const details: any[] = [];

  for (const s of (sources ?? []) as Source[]) {
    try {
      const r = await ingestOpenDataSoftUltraSafe(s);
      totalCreated += r.created;
      details.push({ source: s.name, created: r.created, url: r.url });
    } catch (e: any) {
      details.push({ source: s.name, error: e?.message ?? "error" });
    }
  }

  await supabase.from("ingest_runs").insert({
    status: "ok",
    created: totalCreated,
    meta: details,
  });

  return NextResponse.json({ ok: true, created: totalCreated, sources: details });
}
