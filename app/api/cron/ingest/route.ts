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

function normalizeText(s: any) {
  return (s ?? "").toString().trim();
}

function scoreFromText(title: string, body: string) {
  const t = (title + " " + body).toLowerCase();

  let score = 0;

  // Strong signals
  if (/(appel d['’]?offre|consultation|tender|rfp|march[eé] public|march[eé]s publics)/i.test(t)) score += 25;

  // Télésurveillance / sécurité
  if (/(t[ée]l[ée]surveillance|telesurveillance|remote monitoring|supervision)/i.test(t)) score += 20;
  if (/(vid[ée]oprotection|cctv|cam[ée]ra|videosurveillance)/i.test(t)) score += 18;
  if (/(contr[oô]le d['’]?acc[eè]s|intrusion|alarme|ssi|incendie|sprinkler)/i.test(t)) score += 14;

  // Audit / conseil sûreté
  if (/(audit|s[ûu]ret[ée]|security audit|diagnostic|conformit[ée])/i.test(t)) score += 15;

  // Formation
  if (/(formation|e-learning|elearning|distanciel|pr[ée]sentiel|sst|incendie|h0b0|habilitations)/i.test(t)) score += 15;

  // Nice-to-have
  if (/(cnaps|apsad|iso\s?27001|iso\s?9001|mase)/i.test(t)) score += 8;

  // Clamp
  if (score > 100) score = 100;
  if (score < 0) score = 0;

  return score;
}

function tagsFromText(title: string, body: string) {
  const t = (title + " " + body).toLowerCase();
  const tags: string[] = [];

  if (/(appel d['’]?offre|consultation|tender|rfp|march[eé] public|march[eé]s publics)/i.test(t)) tags.push("APPEL_OFFRE");
  if (/(t[ée]l[ée]surveillance|telesurveillance|remote monitoring|supervision)/i.test(t)) tags.push("TELESURVEILLANCE");
  if (/(vid[ée]oprotection|cctv|cam[ée]ra|videosurveillance)/i.test(t)) tags.push("VIDEO");
  if (/(audit|s[ûu]ret[ée]|security audit|diagnostic|conformit[ée])/i.test(t)) tags.push("AUDIT_SECURITE");
  if (/(formation|e-learning|elearning|distanciel|pr[ée]sentiel|sst|incendie|h0b0)/i.test(t)) tags.push("FORMATION");
  if (/(cnaps|apsad|iso|mase)/i.test(t)) tags.push("EXIGENCES");
  if (/(hse|risques|prévention|qse)/i.test(t)) tags.push("HSE");

  return Array.from(new Set(tags));
}

async function upsertOpportunity(params: {
  title: string;
  url: string;
  published_at?: string | null;
  summary?: string | null;
  raw?: string | null;
  score: number;
  tags: string[];
}) {
  const supabase = supabaseServer();

  // Dedup = URL unique
  const { data: existing } = await supabase
    .from("opportunities")
    .select("id")
    .eq("url", params.url)
    .maybeSingle();

  if (existing?.id) return { created: false };

  const { error } = await supabase.from("opportunities").insert({
    title: params.title,
    url: params.url,
    published_at: params.published_at ?? null,
    summary: params.summary ?? null,
    raw: params.raw ?? null,
    score: params.score,
    tags: params.tags,
    status: "NEW",
  });

  if (error) throw error;

  return { created: true };
}

// -------- RSS INGEST --------
async function ingestRSS(source: Source) {
  const res = await fetch(source.url, { cache: "no-store" });
  if (!res.ok) throw new Error(`RSS fetch failed: ${source.name}`);

  const xml = await res.text();

  // Very simple RSS parse (items)
  const items = xml.match(/<item>([\s\S]*?)<\/item>/g) ?? [];
  let created = 0;

  for (const item of items.slice(0, 40)) {
    const title = normalizeText(item.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/)?.[1] ?? item.match(/<title>([\s\S]*?)<\/title>/)?.[1]);
    const link = normalizeText(item.match(/<link>([\s\S]*?)<\/link>/)?.[1]);
    const pubDate = normalizeText(item.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1]);

    const description =
      normalizeText(
        item.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/)?.[1] ??
          item.match(/<description>([\s\S]*?)<\/description>/)?.[1]
      ) || "";

    if (!title || !link) continue;

    const score = scoreFromText(title, description);
    const tags = tagsFromText(title, description);

    // Filtrage léger : on garde un minimum de pertinence
    if (score < 20) continue;

    const r = await upsertOpportunity({
      title,
      url: link,
      published_at: pubDate ? new Date(pubDate).toISOString() : null,
      summary: description.slice(0, 600),
      raw: description,
      score,
      tags,
    });

    if (r.created) created++;
  }

  return { created };
}

// -------- API INGEST (BOAMP/JOUE) --------
async function ingestBOAMPExploreAPI(source: Source) {
  // BOAMP explore v2 : supports where / limit / order_by
  // We take latest records
  const url = new URL(source.url);
  url.searchParams.set("limit", "50");
  url.searchParams.set("order_by", "dateparution desc");

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error(`API fetch failed: ${source.name}`);

  const json = await res.json();
  const results = (json?.results ?? []) as any[];

  let created = 0;

  for (const r of results) {
    const title =
      normalizeText(r?.intitule) ||
      normalizeText(r?.objet) ||
      normalizeText(r?.titre) ||
      normalizeText(r?.libelle) ||
      "Opportunité";

    const link =
      normalizeText(r?.url) ||
      normalizeText(r?.lien) ||
      normalizeText(r?.source) ||
      "";

    // If there is no direct link, we generate one
    const fallbackLink = link || `${source.url}?ref=${encodeURIComponent(normalizeText(r?.id ?? r?.identifiant ?? title))}`;

    const body = JSON.stringify(r);

    const score = scoreFromText(title, body);
    const tags = tagsFromText(title, body);

    // Keep only relevant
    if (score < 25) continue;

    const pub =
      normalizeText(r?.dateparution) ||
      normalizeText(r?.datepublication) ||
      normalizeText(r?.date) ||
      null;

    const summary =
      normalizeText(r?.resume) ||
      normalizeText(r?.description) ||
      normalizeText(r?.objet) ||
      "";

    const out = await upsertOpportunity({
      title,
      url: fallbackLink,
      published_at: pub ? new Date(pub).toISOString() : null,
      summary: summary ? summary.slice(0, 600) : null,
      raw: body,
      score,
      tags,
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
    .eq("is_active", true);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let totalCreated = 0;
  const details: any[] = [];

  for (const s of (sources ?? []) as Source[]) {
    try {
      if (s.type === "RSS") {
        const r = await ingestRSS(s);
        totalCreated += r.created;
        details.push({ source: s.name, type: s.type, created: r.created });
      } else if (s.type === "API") {
        // BOAMP/JOUE Explore v2
        const r = await ingestBOAMPExploreAPI(s);
        totalCreated += r.created;
        details.push({ source: s.name, type: s.type, created: r.created });
      } else {
        details.push({ source: s.name, type: s.type, created: 0, skipped: true });
      }
    } catch (e: any) {
      details.push({ source: s.name, type: s.type, error: e?.message ?? "error" });
    }
  }

  // log run
  await supabase.from("ingest_runs").insert({
    status: "ok",
    created: totalCreated,
    meta: details,
  });

  return NextResponse.json({
    ok: true,
    created: totalCreated,
    sources: details,
  });
}
