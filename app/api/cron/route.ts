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

function safeJsonStringify(v: any) {
  try {
    return JSON.stringify(v);
  } catch {
    return "";
  }
}

function detectSourceFamily(sourceUrl: string) {
  const u = (sourceUrl || "").toLowerCase();

  if (u.includes("projets-dachats-publics")) return "APPROCH";
  if (u.includes("marches-publics-conclus-recenses")) return "PLACE";

  // si c'est le dataset BOAMP DILA
  if (u.includes("boamp-datadila.opendatasoft.com") || u.includes("/dataset/boamp/")) return "BOAMP";

  // dataset joue (souvent via boamp)
  if (u.includes("/dataset/joue/") || u.includes("joue")) return "JOUE";

  return "UNKNOWN";
}

function extractCpvCodes(record: any): string[] {
  const codes: string[] = [];

  if (record?.cpv) {
    if (Array.isArray(record.cpv)) {
      codes.push(...record.cpv.map((x: any) => normalizeText(x)));
    } else {
      codes.push(normalizeText(record.cpv));
    }
  }

  const raw = safeJsonStringify(record);

  const matches1 = raw.match(/"cpv"\s*:\s*"([0-9]{8})"/gi) ?? [];
  for (const m of matches1) {
    const num = m.match(/"([0-9]{8})"/)?.[1];
    if (num) codes.push(num);
  }

  const matches2 =
    raw.match(/"@listName"\s*:\s*"cpv"[\s\S]{0,120}?"#text"\s*:\s*"([0-9]{8})"/gi) ?? [];
  for (const m of matches2) {
    const num = m.match(/"([0-9]{8})"/)?.[1];
    if (num) codes.push(num);
  }

  const matches3 = raw.match(/"cpv"[^0-9]{0,40}([0-9]{8})/gi) ?? [];
  for (const m of matches3) {
    const num = m.match(/([0-9]{8})/)?.[1];
    if (num) codes.push(num);
  }

  return Array.from(
    new Set(
      codes
        .map((x) => normalizeText(x))
        .filter(Boolean)
        .map((x) => x.replace(/[^0-9]/g, ""))
        .filter((x) => x.length === 8)
    )
  );
}

function hasAllowedCPV(cpvList: string[]) {
  if (!cpvList.length) return false;
  return cpvList.some((cpv) => CPV_CODES.some((allowed) => cpv.startsWith(allowed)));
}

function tagsFromCPV(cpvList: string[], sourceUrl: string) {
  const joined = cpvList.join(" ");
  const isApproch = sourceUrl.includes("projets-dachats-publics");

  if (/(^|[^0-9])7971/i.test(joined)) {
    const tags: string[] = ["APPEL_OFFRE", "FAM_TELE", "GARDIENNAGE"];
    if (isApproch) tags.push("PROJET_AMONT");
    return tags;
  }

  if (/(^|[^0-9])805/i.test(joined)) {
    const tags: string[] = ["APPEL_OFFRE", "FAM_FORMATION", "FORMATION"];
    if (isApproch) tags.push("PROJET_AMONT");
    return tags;
  }

  return [];
}

function scoreFromCPV(cpvList: string[]) {
  if (!cpvList.length) return 0;
  const joined = cpvList.join(" ");

  if (/(^|[^0-9])7971/i.test(joined)) return 85;
  if (/(^|[^0-9])805/i.test(joined)) return 80;

  return 60;
}

async function upsertOpportunity(params: {
  title: string;
  url: string;
  published_at?: string | null;
  summary?: string | null;
  raw?: string | null;
  score: number;
  tags: string[];
  source_family: string;
}) {
  const supabase = supabaseServer();

  if (params.url) {
    const { data: existing } = await supabase.from("opportunities").select("id").eq("url", params.url).maybeSingle();
    if (existing?.id) return { created: false };
  }

  if (!params.url && params.title) {
    const { data: existingTitle } = await supabase
      .from("opportunities")
      .select("id")
      .eq("title", params.title)
      .maybeSingle();

    if (existingTitle?.id) return { created: false };
  }

  const { error } = await supabase.from("opportunities").insert({
    title: params.title,
    url: params.url,
    published_at: params.published_at ?? null,
    summary: params.summary ?? null,
    raw: params.raw ?? null,
    score: params.score,
    tags: params.tags,
    source_family: params.source_family,
    status: "NEW",
  });

  if (error) throw error;
  return { created: true };
}

function buildWhereCPVOnly() {
  return CPV_CODES.map((c) => `cpv LIKE '${c}%'`).join(" OR ");
}

async function ingestOpenDataSoftCPVOnly(source: Source) {
  const where = buildWhereCPVOnly();

  const url = new URL(source.url);
  url.searchParams.set("limit", "120");
  url.searchParams.set("order_by", "dateparution desc");
  url.searchParams.set("where", where);

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error(`API fetch failed: ${source.name}`);

  const json = await res.json();
  const results = (json?.results ?? []) as any[];
  let created = 0;

  const source_family = detectSourceFamily(source.url);

  for (const r of results) {
    const cpvList = extractCpvCodes(r);

    if (!hasAllowedCPV(cpvList)) continue;

    const tags = tagsFromCPV(cpvList, source.url);
    if (!tags.length) continue;

    const title = normalizeText(r?.intitule || r?.objet || r?.titre || r?.libelle || "Opportunité");
    const pub = normalizeText(r?.dateparution || r?.datepublication || r?.date || "");
    const summary = normalizeText(r?.objet || r?.description || r?.resume || "");

    const link =
      normalizeText(r?.url_avis || r?.url || r?.lien || r?.source || "") ||
      `${source.url}?ref=${encodeURIComponent(normalizeText(r?.idweb || r?.id || title))}`;

    const score = scoreFromCPV(cpvList);

    const out = await upsertOpportunity({
      title,
      url: link,
      published_at: pub ? new Date(pub).toISOString() : null,
      summary: summary ? summary.slice(0, 600) : null,
      raw: safeJsonStringify(r),
      score,
      tags,
      source_family,
    });

    if (out.created) created++;
  }

  return { created };
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
      const r = await ingestOpenDataSoftCPVOnly(s);
      totalCreated += r.created;
      details.push({ source: s.name, created: r.created });
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
