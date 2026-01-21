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

// --------------------- CPV + Keywords (BOAMP) ---------------------
const CPV_CODES = [
  "79711000", // alarm monitoring
  "79710000", // security services
  "45312000", // alarm installation works
  "50610000", // repair/maintenance security equipment
  "35120000", // surveillance systems supply
  "71317100", // fire protection & control consultancy
  "79417000", // security consultancy
  "71317000", // risk protection & control consultancy
  "80550000", // security training
  "80561000", // health training / SST
];

const KEYWORDS = [
  "télésurveillance",
  "telesurveillance",
  "remote monitoring",
  "supervision",
  "alarme",
  "intrusion",
  "vidéoprotection",
  "videosurveillance",
  "cctv",
  "caméra",
  "contrôle d'accès",
  "controle d acces",
  "audit sécurité",
  "audit sûreté",
  "audit surete",
  "sûreté",
  "surete",
  "sécurité privée",
  "security audit",
  "formation sécurité",
  "e-learning",
  "elearning",
  "sst",
  "secourisme",
  "incendie",
];

// --------------------- ANTI-BRUIT (hors scope) ---------------------
// Dès qu'on tombe sur ces domaines : eau potable, voirie, déchets, etc.
// on évite la qualification "Audit/Formation/Télésurveillance".
const NOISE_PATTERNS: RegExp[] = [
  /\beau potable\b/i,
  /\bassainissement\b/i,
  /\bréseau(x)? d['’]?eau\b/i,
  /\bstation d['’]?épuration\b/i,
  /\bdéchets\b/i,
  /\bcollecte\b.*\bordures\b/i,
  /\bvoirie\b/i,
  /\bchaussée\b/i,
  /\benrob[ée]s?\b/i,
  /\béclairage public\b/i,
  /\broute\b/i,
  /\bgoudron\b/i,
  /\bforage\b/i,
  /\bcanalisations?\b/i,
  /\bplomberie\b/i,
  /\bchauffage\b/i,
  /\bventilation\b/i,
  /\bclimatisation\b/i,
  /\brestauration\b/i,
  /\bcantine\b/i,
  /\bnettoyage\b/i,
  /\bpropret[ée]\b/i,
  /\bd[ée]m[ée]nagement\b/i,
  /\btransport\b/i,
  /\bcollectiv(e|it[ée])\b/i,
  /\bespace vert\b/i,
  /\bjardinage\b/i,
  /\btravaux de peinture\b/i,
  /\bma[çc]onnerie\b/i,
  /\bcharpente\b/i,
  /\bcouverture\b/i,
];

// --------------------- Detection stricte métier ---------------------
// On attribue une FAMILLE uniquement si on a un "signal sécurité" fort.

const TELE_PATTERNS: RegExp[] = [
  /\bt[ée]l[ée]surveillance\b/i,
  /\btelesurveillance\b/i,
  /\bremote monitoring\b/i,
  /\bsupervision\b/i,
  /\bcentre de t[ée]l[ée]surveillance\b/i,
  /\bpc s[ée]curit[ée]\b/i,
  /\bpcs\b/i,
  /\balarme\b/i,
  /\bintrusion\b/i,
  /\btransmission\b/i,
  /\bvideo(surveillance)?\b/i,
  /\bcctv\b/i,
  /\bvid[ée]oprotection\b/i,
];

const AUDIT_SEC_PATTERNS: RegExp[] = [
  /\baudit\b.*\bs[ée]curit[ée]\b/i,
  /\baudit\b.*\bs[ûu]ret[ée]\b/i,
  /\baudit\b.*\bsurete\b/i,
  /\bdiagnostic\b.*\bs[ée]curit[ée]\b/i,
  /\bconformit[ée]\b.*\bssi\b/i,
  /\bapsad\b/i,
  /\bcnaps\b/i,
  /\biso\s?27001\b/i,
  /\biso\s?9001\b/i,
  /\bcontr[oô]le d['’]?acc[eè]s\b/i,
  /\bintrusion\b/i,
  /\balarme\b/i,
  /\bvid[ée]oprotection\b/i,
  /\bcctv\b/i,
  /\bsyst[èe]me(s)? de s[ée]curit[ée]\b/i,
  /\bs[ée]curit[ée]\s+incendie\b/i,
  /\bssi\b/i,
];

const FORMATION_PATTERNS: RegExp[] = [
  /\bformation\b/i,
  /\bformateur\b/i,
  /\bcentre de formation\b/i,
  /\bstage\b/i,
  /\be[-\s]?learning\b/i,
  /\belearning\b/i,
  /\bdistanciel\b/i,
  /\bpr[ée]sentiel\b/i,
  /\bmodalit[ée]s? p[ée]dagogiques?\b/i,
  /\bquiz\b/i,
  /\bcertification\b/i,
  /\bhabilitations?\b/i,
  /\bsst\b/i,
  /\bsecourisme\b/i,
  /\bincendie\b/i,
  /\bh0b0\b/i,
  /\baps\b/i,
];

// Pour la formation, on évite les formations hors scope type "RH", "SAP", etc
// mais ici on reste "sécurité" (SST, incendie, etc) déjà couvert.
const FORMATION_SECURITY_GUARD: RegExp[] = [
  /\bs[ée]curit[ée]\b/i,
  /\bsurete\b/i,
  /\bs[ûu]ret[ée]\b/i,
  /\bincendie\b/i,
  /\bsst\b/i,
  /\bsecourisme\b/i,
  /\bcontr[oô]le d['’]?acc[eè]s\b/i,
  /\bvid[ée]oprotection\b/i,
  /\bcctv\b/i,
];

function normalizeText(v: any) {
  return (v ?? "").toString().trim();
}

function compactText(v: any) {
  return normalizeText(v).toLowerCase();
}

function isNoise(text: string) {
  return NOISE_PATTERNS.some((r) => r.test(text));
}

function matchesAny(text: string, patterns: RegExp[]) {
  return patterns.some((r) => r.test(text));
}

// Détermine la famille métier (strict)
function detectFamilies(title: string, body: string) {
  const t = (title + " " + body).toLowerCase();

  // Anti-bruit global
  if (isNoise(t)) {
    return {
      famTele: false,
      famAudit: false,
      famFormation: false,
      blockedByNoise: true,
    };
  }

  const famTele = matchesAny(t, TELE_PATTERNS);

  const famAudit = matchesAny(t, AUDIT_SEC_PATTERNS);

  // Formation : il faut le mot formation + un signal sécurité (guard)
  const hasFormation = matchesAny(t, FORMATION_PATTERNS);
  const formationGuard = matchesAny(t, FORMATION_SECURITY_GUARD);
  const famFormation = hasFormation && formationGuard;

  return {
    famTele,
    famAudit,
    famFormation,
    blockedByNoise: false,
  };
}

function scoreFromText(title: string, body: string) {
  const t = (title + " " + body).toLowerCase();
  let score = 0;

  // Appel d'offre / consultation
  if (/(appel d['’]?offre|consultation|tender|rfp|march[eé] public|march[eé]s publics)/i.test(t)) score += 25;

  // Familles strictes
  const fam = detectFamilies(title, body);

  if (fam.blockedByNoise) return 0;

  if (fam.famTele) score += 25;
  if (fam.famAudit) score += 20;
  if (fam.famFormation) score += 20;

  // Exigences / normes
  if (/(cnaps|apsad|iso\s?27001|iso\s?9001|mase)/i.test(t)) score += 8;

  if (score > 100) score = 100;
  if (score < 0) score = 0;

  return score;
}

function tagsFromText(title: string, body: string) {
  const t = (title + " " + body).toLowerCase();
  const tags: string[] = [];

  const fam = detectFamilies(title, body);

  if (fam.blockedByNoise) {
    tags.push("BRUIT");
    return Array.from(new Set(tags));
  }

  if (/(appel d['’]?offre|consultation|tender|rfp|march[eé] public|march[eé]s publics)/i.test(t)) tags.push("APPEL_OFFRE");

  // Familles métier propres
  if (fam.famTele) tags.push("FAM_TELE", "TELESURVEILLANCE");
  if (fam.famAudit) tags.push("FAM_AUDIT", "AUDIT_SECURITE");
  if (fam.famFormation) tags.push("FAM_FORMATION", "FORMATION");

  // Exigences
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

  // DEDUP URL
  const { data: existing } = await supabase.from("opportunities").select("id").eq("url", params.url).maybeSingle();
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

// ---------------- RSS INGEST ----------------
async function ingestRSS(source: Source) {
  const res = await fetch(source.url, { cache: "no-store" });
  if (!res.ok) throw new Error(`RSS fetch failed: ${source.name}`);

  const xml = await res.text();
  const items = xml.match(/<item>([\s\S]*?)<\/item>/g) ?? [];
  let created = 0;

  for (const item of items.slice(0, 60)) {
    const title =
      normalizeText(
        item.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/)?.[1] ??
          item.match(/<title>([\s\S]*?)<\/title>/)?.[1]
      ) || "";
    const link = normalizeText(item.match(/<link>([\s\S]*?)<\/link>/)?.[1] ?? "");
    const pubDate = normalizeText(item.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] ?? "");

    const description =
      normalizeText(
        item.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/)?.[1] ??
          item.match(/<description>([\s\S]*?)<\/description>/)?.[1]
      ) || "";

    if (!title || !link) continue;

    const score = scoreFromText(title, description);
    if (score < 30) continue;

    const tags = tagsFromText(title, description);
    if (tags.includes("BRUIT")) continue;

    const r = await upsertOpportunity({
      title,
      url: link,
      published_at: pubDate ? new Date(pubDate).toISOString() : null,
      summary: description ? description.slice(0, 600) : null,
      raw: description || null,
      score,
      tags,
    });

    if (r.created) created++;
  }

  return { created };
}

// ---------------- BOAMP DILA API (CPV OR KEYWORDS) ----------------
function buildBOAMPWhere() {
  const cpvOr = CPV_CODES.map((c) => `cpv LIKE '${c}%'`).join(" OR ");

  const kwOr = KEYWORDS.map((k) => {
    const kk = k.replace(/'/g, "''").toLowerCase();
    return `(lower(objet) like '%${kk}%' OR lower(intitule) like '%${kk}%' OR lower(description) like '%${kk}%')`;
  }).join(" OR ");

  return `((${cpvOr}) OR (${kwOr}))`;
}

async function ingestBOAMPDILA(source: Source) {
  const where = buildBOAMPWhere();

  const url = new URL(source.url);
  url.searchParams.set("limit", "120");
  url.searchParams.set("order_by", "dateparution desc");
  url.searchParams.set("where", where);

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error(`BOAMP DILA fetch failed: ${source.name}`);

  const json = await res.json();
  const results = (json?.results ?? []) as any[];
  let created = 0;

  for (const r of results) {
    const title = normalizeText(r?.intitule || r?.objet || r?.titre || r?.libelle || "Opportunité");
    const pub = normalizeText(r?.dateparution || r?.datepublication || r?.date || "");
    const body = JSON.stringify(r);

    const link =
      normalizeText(r?.url_avis || r?.url || r?.lien || r?.source || "") ||
      `${source.url}?ref=${encodeURIComponent(normalizeText(r?.idweb || r?.id || r?.identifiant || title))}`;

    const summary = normalizeText(r?.objet || r?.description || r?.resume || "");

    const score = scoreFromText(title, body);
    if (score < 35) continue;

    const tags = tagsFromText(title, body);
    if (tags.includes("BRUIT")) continue;

    const out = await upsertOpportunity({
      title,
      url: link,
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
        const r = await ingestBOAMPDILA(s);
        totalCreated += r.created;
        details.push({ source: s.name, type: s.type, created: r.created });
      } else {
        details.push({ source: s.name, type: s.type, created: 0, skipped: true });
      }
    } catch (e: any) {
      details.push({ source: s.name, type: s.type, error: e?.message ?? "error" });
    }
  }

  await supabase.from("ingest_runs").insert({
    status: "ok",
    created: totalCreated,
    meta: details,
  });

  return NextResponse.json({ ok: true, created: totalCreated, sources: details });
}

