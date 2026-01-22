import Link from "next/link";

export const runtime = "nodejs";

export default function DashboardHome() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-6xl mx-auto px-6 py-10 space-y-6">
        <div>
          <div className="text-3xl font-bold">AO Radar — Dashboard</div>
          <div className="text-sm text-slate-300 mt-2">
            Accès rapide aux pages principales.
          </div>
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

        <div className="bg-white rounded-xl text-black p-5">
          <div className="text-sm font-semibold">✅ Build fix</div>
          <div className="text-sm text-slate-700 mt-1">
            Ce fichier existe uniquement pour que Next.js compile correctement.
          </div>
        </div>
      </div>
    </div>
  );
}
