import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";

function safeJsonParse(input: any) {
  if (!input) return null;
  if (typeof input === "object") return input;
  try {
    return JSON.parse(input);
  } catch {
    return null;
  }
}

function formatDate(v: any) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString("fr-FR");
}

function Row({ label, value }: { label: string; value: any }) {
  const v =
    value === null || value === undefined || value === ""
      ? "—"
      : Array.isArray(value)
      ? value.join(", ")
      : String(value);

  return (
    <div className="grid grid-cols-3 gap-3 py-2 border-b border-slate-200">
      <div className="text-sm font-medium text-slate-600">{label}</div>
      <div className="col-span-2 text-sm text-slate-900 break-words">{v}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <div className="text-base font-semibold text-slate-900 mb-3">{title}</div>
      <div>{children}</div>
    </div>
  );
}

export default async function OpportunityPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;

  const supabase = supabaseServer();

  const { data, error } = await supabase
    .from("opportunities")
    .select("id,title,url,summary,raw,score,status,tags,created_at,published_at")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return notFound();

  const rawObj = safeJsonParse(data.raw);
  const raw = rawObj || {};

  // Champs BOAMP / JOUE standards
  const idweb = raw?.idweb ?? raw?.id ?? raw?.IDWEB ?? null;
  const contractfolderid = raw?.contractfolderid ?? raw?.contractFolderId ?? null;

  const objet = raw?.objet ?? raw?.intitule ?? data.title ?? null;
  const famille = raw?.famille ?? null;
  const famille_libelle = raw?.famille_libelle ?? null;

  const dateparution = raw?.dateparution ?? data.published_at ?? null;
  const datefindiffusion = raw?.datefindiffusion ?? null;
  const datelimitereponse = raw?.datelimitereponse ?? null;

  const nomacheteur = raw?.nomacheteur ?? raw?.acheteur ?? null;
  const titulaire = raw?.titulaire ?? null;

  const perimetre = raw?.perimetre ?? null;
  const type_procedure = raw?.type_procedure ?? null;
  const procedure_libelle = raw?.procedure_libelle ?? null;

  const nature = raw?.nature ?? null;
  const nature_libelle = raw?.nature_libelle ?? null;

  const criteres = raw?.criteres ?? null;

  const dep = raw?.code_departement ?? null;
  const descripteur_code = raw?.descripteur_code ?? null;
  const descripteur_libelle = raw?.descripteur_libelle ?? null;

  const urlAvis = raw?.url_avis ?? data.url ?? null;

  // JSON techniques encodés
  const gestionObj = safeJsonParse(raw?.gestion);
  const donneesObj = safeJsonParse(raw?.donnees);

  // Extraction eForms (buyer / montants)
  const noticeResult =
    donneesObj?.EFORMS?.ContractAwardNotice?.["ext:UBLExtensions"]?.["ext:UBLExtension"]?.["ext:ExtensionContent"]?.[
      "efext:EformsExtension"
    ]?.["efac:NoticeResult"];

  const maxFramework =
    noticeResult?.["efbc:OverallMaximumFrameworkContractsAmount"]?.["#text"] ??
    noticeResult?.["efbc:OverallMaximumFrameworkContractsAmount"] ??
    null;

  const lotResult = noticeResult?.["efac:LotResult"] ?? null;
  const higherTender = lotResult?.["cbc:HigherTenderAmount"]?.["#text"] ?? null;
  const lowerTender = lotResult?.["cbc:LowerTenderAmount"]?.["#text"] ?? null;

  const submissions =
    lotResult?.["efac:ReceivedSubmissionsStatistics"]?.["efbc:StatisticsNumeric"] ??
    lotResult?.["efac:ReceivedSubmissionsStatistics"] ??
    null;

  const orgs =
    donneesObj?.EFORMS?.ContractAwardNotice?.["ext:UBLExtensions"]?.["ext:UBLExtension"]?.["ext:ExtensionContent"]?.[
      "efext:EformsExtension"
    ]?.["efac:Organizations"]?.["efac:Organization"];

  const orgArray = Array.isArray(orgs) ? orgs : orgs ? [orgs] : [];
  const buyer = orgArray?.[0]?.["efac:Company"] ?? null;

  const buyerEmail = buyer?.["cac:Contact"]?.["cbc:ElectronicMail"] ?? null;
  const buyerTel = buyer?.["cac:Contact"]?.["cbc:Telephone"] ?? null;
  const buyerCity = buyer?.["cac:PostalAddress"]?.["cbc:CityName"] ?? null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-2xl font-bold">{data.title}</div>
            <div className="text-sm text-slate-600 mt-1">
              Score: <span className="font-semibold">{data.score}</span> • Statut:{" "}
              <span className="font-semibold">{data.status}</span> • Créé le {formatDate(data.created_at)}
            </div>
          </div>

          <div className="flex gap-2">
            <Link
              href="/dashboard"
              className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 hover:bg-slate-100"
            >
              Retour
            </Link>
            {urlAvis ? (
              <a
                href={urlAvis}
                target="_blank"
                className="px-3 py-2 rounded-lg bg-black text-white hover:opacity-90"
              >
                Ouvrir l’avis
              </a>
            ) : null}
          </div>
        </div>

        {/* Résumé */}
        {data.summary ? (
          <Section title="Résumé">
            <div className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">{data.summary}</div>
          </Section>
        ) : null}

        {/* Fiche structurée */}
        <div className="grid md:grid-cols-2 gap-6">
          <Section title="Identifiants">
            <Row label="ID Web" value={idweb} />
            <Row label="ID interne" value={data.id} />
            <Row label="Contract Folder ID" value={contractfolderid} />
            <Row label="Famille" value={famille} />
            <Row label="Libellé famille" value={famille_libelle} />
          </Section>

          <Section title="Objet / Sujet">
            <Row label="Objet" value={objet} />
            <Row label="Descripteur (codes)" value={descripteur_code} />
            <Row label="Descripteur (libellés)" value={descripteur_libelle} />
            <Row label="Tags" value={data.tags} />
          </Section>

          <Section title="Publication & Diffusion">
            <Row label="Date de parution" value={formatDate(dateparution)} />
            <Row label="Fin diffusion" value={formatDate(datefindiffusion)} />
            <Row label="Date limite réponse" value={formatDate(datelimitereponse)} />
          </Section>

          <Section title="Acheteur / Attributaire">
            <Row label="Acheteur" value={nomacheteur} />
            <Row label="Titulaire" value={titulaire} />
            <Row label="Département" value={dep} />
            <Row label="Périmètre" value={perimetre} />
          </Section>

          <Section title="Procédure">
            <Row label="Type procédure" value={type_procedure} />
            <Row label="Libellé procédure" value={procedure_libelle} />
            <Row label="Nature" value={nature} />
            <Row label="Nature (libellé)" value={nature_libelle} />
            <Row label="Critères" value={criteres} />
          </Section>

          <Section title="Données eForms (extraits)">
            <Row label="Ville acheteur" value={buyerCity} />
            <Row label="Email acheteur" value={buyerEmail} />
            <Row label="Téléphone acheteur" value={buyerTel} />
            <Row label="Montant max cadre (€)" value={maxFramework} />
            <Row label="Offre max (€)" value={higherTender} />
            <Row label="Offre min (€)" value={lowerTender} />
            <Row label="Soumissions reçues" value={submissions} />
          </Section>
        </div>

        {/* JSON technique */}
        <div className="grid md:grid-cols-2 gap-6">
          <Section title="Gestion (JSON)">
            <pre className="text-xs bg-slate-100 border border-slate-200 rounded-lg p-3 overflow-auto max-h-[420px]">
              {gestionObj ? JSON.stringify(gestionObj, null, 2) : "—"}
            </pre>
          </Section>

          <Section title="Données (JSON)">
            <pre className="text-xs bg-slate-100 border border-slate-200 rounded-lg p-3 overflow-auto max-h-[420px]">
              {donneesObj ? JSON.stringify(donneesObj, null, 2) : "—"}
            </pre>
          </Section>
        </div>
      </div>
    </div>
  );
}
