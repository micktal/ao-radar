export default function Home() {
  return (
    <main className="min-h-screen p-10">
      <h1 className="text-4xl font-semibold">AO Radar</h1>
      <p className="mt-3 text-sm opacity-80">
        MVP Fiducial: collecte RSS + scoring automatique + dashboard de leads.
      </p>

      <div className="mt-6 flex gap-3">
        <a
          className="rounded-md border px-4 py-2 hover:bg-black hover:text-white"
          href="/dashboard"
        >
          Dashboard
        </a>
        <a
          className="rounded-md border px-4 py-2 hover:bg-black hover:text-white"
          href="/dashboard/sources"
        >
          Sources
        </a>
      </div>

      <div className="mt-10 rounded-xl border p-5 text-sm opacity-80">
        <p className="font-medium opacity-100">Objectif</p>
        <p className="mt-2">
          Permettre à des alternants de qualifier rapidement des opportunités
          télésurveillance / audits sécurité / formation (présentiel, distanciel, e-learning).
        </p>
      </div>
    </main>
  );
}
