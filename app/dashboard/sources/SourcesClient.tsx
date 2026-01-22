"use client";

import React from "react";

type Source = {
  id: string;
  name: string;
  type: "RSS" | "API";
  url: string;
  is_active: boolean;
};

function badgeType(t: Source["type"]) {
  if (t === "API") return "bg-black text-white";
  return "bg-white text-black border border-black";
}

export default function SourcesClient({ sources }: { sources: Source[] }) {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-6xl mx-auto px-6 py-10 space-y-6">
        <div>
          <div className="text-3xl font-bold">Sources</div>
          <div className="text-sm text-slate-300 mt-1">
            Active / désactive directement depuis l’interface (sans SQL).
          </div>
        </div>

        <div className="bg-white rounded-xl overflow-hidden">
          <div className="grid grid-cols-12 px-4 py-3 border-b border-slate-200 text-sm font-semibold text-slate-900">
            <div className="col-span-1">Actif</div>
            <div className="col-span-4">Nom</div>
            <div className="col-span-1">Type</div>
            <div className="col-span-6">URL</div>
          </div>

          {sources.length === 0 ? (
            <div className="px-4 py-6 text-sm text-slate-600">Aucune source.</div>
          ) : (
            sources.map((s) => (
              <div
                key={s.id}
                className="grid grid-cols-12 px-4 py-4 border-b border-slate-200 text-sm text-slate-900 bg-white items-center"
              >
                <div className="col-span-1">
                  <Toggle sourceId={s.id} initialActive={s.is_active} />
                </div>

                <div className="col-span-4 font-medium">{s.name}</div>

                <div className="col-span-1">
                  <span className={`inline-flex px-2 py-1 text-xs rounded-full ${badgeType(s.type)}`}>
                    {s.type}
                  </span>
                </div>

                <div className="col-span-6">
                  <a
                    href={s.url}
                    target="_blank"
                    className="underline text-slate-800 hover:text-black break-all"
                    rel="noreferrer"
                  >
                    {s.url}
                  </a>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function Toggle({ sourceId, initialActive }: { sourceId: string; initialActive: boolean }) {
  const [active, setActive] = React.useState(initialActive);
  const [loading, setLoading] = React.useState(false);

  async function toggle(next: boolean) {
    setLoading(true);
    setActive(next);

    const res = await fetch("/api/sources/toggle", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ source_id: sourceId, is_active: next }),
    });

    setLoading(false);

    if (!res.ok) {
      alert("Erreur lors du toggle (admin requis).");
      setActive(!next);
      return;
    }
  }

  return (
    <label className="inline-flex items-center cursor-pointer">
      <input
        type="checkbox"
        checked={active}
        disabled={loading}
        onChange={(e) => toggle(e.target.checked)}
        className="sr-only peer"
      />
      <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:bg-black relative opacity-100 disabled:opacity-60">
        <div className="absolute top-0.5 left-0.5 bg-white w-5 h-5 rounded-full transition-all peer-checked:translate-x-5" />
      </div>
    </label>
  );
}
