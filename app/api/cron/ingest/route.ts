import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { XMLParser } from "fast-xml-parser";

export const runtime = "nodejs";

type SourceRow = {
  id: string;
  name: string;
  type: "RSS";
  url: string;
  is_active: boolean;
};

type RssItem = {
  title?: string;
  link?: string;
  pubDate?: string;
  description?: string;
  summary?: string;
};

function cleanHtmlToText(input: string) {
  return (input || "")
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseFrenchDateToIso(s: string): string | null {
  // formats supportés: 20/01/2026, 20-01-2026, 20.01.2026
  const m = s.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/);
  if (!m) return null;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  let yy = Number(m[3]);
  if (yy < 100) yy += 2000;
  const d = new Date(Date.UTC(yy, mm - 1, dd, 12, 0, 0)); // midi UTC pour éviter décalage
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

function extractDeadline(text: string): string | null {
  const t = text.toLowerCase();

  // Cherche une “date limite / deadline / remise des offres” + date
  const patterns = [
    /(?:date limite|deadline|remise des offres|closing date|cl[ôo]ture).*?(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/i,
    /(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}).*?(?:date limite|deadline|remise des offres|closing date|cl[ôo]ture)/i,
  ];

  for (const re of patterns) {
    const m = t.match(re);
    if (m?.[1]) {
      const iso = parseFrenchDateToIso(m[1]);
      if (iso) return iso;
    }
  }

  // fallback: première date du texte (moins fiable)
  const any = t.match(/\b(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})\b/);
  if (any?.[1]) {
    const iso = parseFrenchDateToIso(any[1]);
    if (iso) return iso;
  }

  return null;
}

function extractBuyer(title: string, text: string): string | null {
  // heuristique simple: cherche “Ville de X”, “Mairie de X”, “CHU”, “Groupe”, “Société”
  const corpus = `${title}\n${text}`.trim();

  const candidates = [
    /\b(Ville de [A-ZÀ-ÖØ-Ý][\wÀ-ÿ' -]{2,50})\b/,
    /\b(Mairie de [A-ZÀ-ÖØ-Ý][\wÀ-ÿ' -]{2,50})\b/,
    /\b(CHU [A-ZÀ-ÖØ-Ý][\wÀ-ÿ' -]{2,50})\b/,
    /\b(Centre Hospitalier [A-ZÀ-ÖØ-Ý][\wÀ-ÿ' -]{2,50})\b/,
    /\b(Groupe [A-ZÀ-ÖØ-Ý][\wÀ-ÿ' -]{2,50})\b/,
  ];

  for (const re of candidates) {
    const m = corpus.match(re);
    if (m?.[1]) return m[1].trim();
  }

  return null;
}

function extractLocation(text: string): string | null {
  // heuristique ultra simple : repère “à Paris”, “sur Lyon”, “site de Lille”
  const t = text.replace(/\s+/g, " ").trim();

  const m =
    t.match(/\b(?:à|au|aux|sur|site de)\s+([A-ZÀ-ÖØ-Ý][\wÀ-ÿ' -]{2,40})\b/) ||
    t.match(/\b(?:Paris|Lyon|Marseille|Toulouse|Nice|Nantes|Strasbourg|Montpellier|Bordeaux|Lille|Rennes|Reims|Le Havre|Saint-Étienne|Toulon|Grenoble|Dijon|Angers|Nîmes)\b/);

  if (!m) return null;
  return (m[1] ?? m[0]).toString().trim();
}

function scoreOpportunity(text: string) {
  const t = text.toLowerCase();

  const rules: Array<[RegExp, number, string]> = [
    [/t[ée]l[ée]surveillance|telesurveillance|remote monitoring|monitoring center/gi, 30, "TELESURVEILLANCE"],
    [/vid[ée]osurveillance|video[-\s]?protection|cctv|camera surveillance/gi, 20, "VIDEO"],
    [/audit\s+(de\s+)?s[ûu]ret[ée]|audit\s+securite|security audit|safety audit/gi, 30, "AUDIT_SECURITE"],
    [/formation|training|e-?learning|distanciel|pr[ée]sentiel|lms|scorm/gi, 25, "FORMATION"],
    [/appel d['’]offre|ao\b|tender|rfp|consultation|march[ée] public|procurement/gi, 35, "APPEL_OFFRE"],
    [/\bcnaps\b|\biso\b|mase|apsad|ssi|surete/gi, 10, "EXIGENCES"],
    [/incendie|evacuation|sst|secourisme|first aid/gi, 10, "HSE"],
  ];

  let score = 0;
  const tags = new Set<string>();

  for (const [re, pts, tag] of rules) {
    if (re.test(t)) {
      score += pts;
      tags.add(tag);
    }
  }

  // Bonus deadline détectée
  if (/(date limite|deadline|remise des offres|closing date|cl[ôo]ture)/i.test(t)) score += 10;

  // Malus hors scope (bruit)
  if (/(bâtiment|construction|vrd|plomberie|menuiserie|peinture)/i.test(t)) score -= 20;

  if (score < 0) score = 0;
  if (score > 100) score = 100;

  return { score, tags: Array.from(tags) };
}

async function fetchRss(url: string) {
  const res = await fetch(url, { headers: { "User-Agent": "AO-Radar/1.0" } });
  if (!res.ok) throw new Error(`RSS fetch failed ${res.status} ${res.statusText}`);
  const xml = await res.text();

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    trimValues: true,
  });

  const data = parser.parse(xml);

  const items: RssItem[] =
    data?.rss?.channel?.item
      ? Array.isArray(data.rss.channel.item)
        ? data.rss.channel.item
        : [data.rss.channel.item]
      : [];

  return items
    .map((it) => {
      const title = cleanHtmlToText((it.title ?? "").toString());
      const link = ((it.link ?? "").toString() || "").trim();
      const pubDate = ((it.pubDate ?? "").toString() || "").trim();
      const desc = cleanHtmlToText(((it.description ?? it.summary ?? "") as string) || "");

      return { title, link, pubDate, description: desc };
    })
    .filter((x) => x.title && x.link);
}

export async function GET(req: Request) {
  const secret = new URL(req.url).searchParams.get("secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = supabaseServer();

  const run = await supabase.from("ingest_runs").insert({}).select("id").single();
  const runId = run.data?.id ?? null;

  try {
    const { data: sources, error: srcErr } = await supabase
      .from("sources")
      .select("id,name,type,url,is_active")
      .eq("is_active", true)
      .eq("type", "RSS");

    if (srcErr) throw srcErr;

    let inserted = 0;
    let updated = 0;
    let scannedItems = 0;

    for (const src of (sources ?? []) as SourceRow[]) {
      const items = await fetchRss(src.url);
      scannedItems += items.length;

      for (const it of items) {
        const raw = `${it.title}\n${it.description}`;
        const { score, tags } = scoreOpportunity(raw);

        if (score < 20) continue;

        let published_at: string | null = null;
        if (it.pubDate) {
          const d = new Date(it.pubDate);
          if (!isNaN(d.getTime())) published_at = d.toISOString();
        }

        const deadline_at = extractDeadline(raw);
        const buyer = extractBuyer(it.title, raw);
        const location = extractLocation(raw);

        const payload = {
          source_id: src.id,
          title: it.title,
          url: it.link,
          published_at,
          deadline_at,
          buyer,
          location,
          summary: it.description ? it.description.slice(0, 900) : null,
          raw,
          score,
          tags,
          // ne pas écraser le travail humain sur update
        };

        const up = await supabase
          .from("opportunities")
          .upsert(payload, { onConflict: "url" })
          .select("id, created_at")
          .single();

        if (up.error) throw up.error;

        const createdAt = new Date(up.data.created_at).getTime();
        const now = Date.now();
        if (now - createdAt < 12_000) inserted += 1;
        else updated += 1;
      }
    }

    if (runId) {
      await supabase
        .from("ingest_runs")
        .update({
          finished_at: new Date().toISOString(),
          inserted_count: inserted,
          updated_count: updated,
          scanned_count: scannedItems,
        })
        .eq("id", runId);
    }

    return NextResponse.json({ ok: true, scannedItems, inserted, updated });
  } catch (e: any) {
    if (runId) {
      await supabase
        .from("ingest_runs")
        .update({ finished_at: new Date().toISOString(), error: e?.message ?? "error" })
        .eq("id", runId);
    }
    return NextResponse.json({ ok: false, error: e?.message ?? "error" }, { status: 500 });
  }
}
