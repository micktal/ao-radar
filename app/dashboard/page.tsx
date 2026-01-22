import Link from "next/link";

export const runtime = "nodejs";

export default async function DashboardHomePage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-6xl mx-auto px-6 py-10 space-y-8">
        <div className="space-y-2">
          <div className="text-4xl font-bold">AO Radar — Dashboard</div>
          <div className="text-slate-300">Accès rapide aux pages principales.</div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/dashboard"
            className="px-4 py-2 rounded-lg border border-white/30 bg-white/5 hover:bg-white/10"
          >
            Accueil
          </Link>

          <Link
            href="/dashboard/today"
            className="px-4 py-2 rounded-lg border border-white/30 bg-white/5 hover:bg-white/10"
          >
            Aujourd’hui
          </Link>

          <Link
            href="/dashboard/sources"
            className="px-4 py-2 rounded-lg border border-white/30 bg-white/5 hover:bg-white/10"
          >
            Sources
          </Link>
        </div>

        <div className="bg-white rounded-xl text-black p-6">
          <div className="text-lg font-bold">Bienvenue 👋</div>
          <div className="text-sm text-slate-700 mt-2">
            Utilise <b>Aujourd’hui</b> pour traiter les opportunités récentes, et <b>Sources</b> pour activer/désactiver
            les connecteurs.
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/dashboard/today"
              className="px-4 py-2 rounded-lg bg-black text-white hover:opacity-90"
            >
              Ouvrir “Aujourd’hui”
            </Link>
            <Link
              href="/dashboard/sources"
              className="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100"
            >
              Gérer les Sources
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
