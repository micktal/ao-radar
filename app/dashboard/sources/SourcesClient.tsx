"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type SourceRow = {
  id: string;
  name: string;
  type: "RSS" | "API";
  url: string;
  is_active: boolean;
};

async function safeReadJson(res: Response) {
  const txt = await res.text();
  if (!txt) return {};
  try {
    return JSON.parse(txt);
  } catch {
    return { raw: txt };
  }
}

export default function SourcesClient({ initialSources }: { initialSources: SourceRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rows, setRows] = useState<SourceRow[]>(initialSources ?? []);

  useEffect(() => {
    setRows(initialSources ?? []);
  }, [initialSources]);

  async function toggleSource(source_id: string, next: boolean) {
    // ✅ Optimistic UI
    setRows((prev) => prev.map((s) => (s.id === source_id ? { ...s, is_active: next } : s)));

    try {
      const res = await fetch("/api/sources/toggle", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ source_id, is_active: next }),
      });

      const json = await safeReadJson(res);

      if (!res.ok) {
        throw new Error(json?.error || `HTTP ${res.status}`);
      }

      // ✅ refresh server data
      startTransition(() => router.refresh());
    } catch (e: any) {
      // rollback
      setRows((prev) => prev.map((s) => (s.id === source_id ? { ...s, is_active: !next } : s)));
      alert("Erreur toggle: " + (e?.message || "unknown"));
    }
  }

  return (
    <div className="bg-white rounded-xl overflow-hidden border border-white/10">
      <div className="grid grid-cols-12 px-4 py-3 border-b border-slate-200 text-sm font-semibold text-slate-900">
        <div className="col-span-1">Actif</div>
        <div className="col-span-4">Nom</div>
        <div className="col-span-1">Type</div>
        <div className="col-span-6">URL</div>
      </div>

      {rows.length === 0 ? (
        <div className="px-4 py-6 text-sm text-slate-600">Aucune source.</div>
      ) : (
        rows.map((s) => (
          <div
            key={s.id}
            className="grid grid-cols-12 px-4 py-4 border-b border-slate-200 text-sm text-slate-900 items-center"
          >
            <div className="col-span-1">
              <button
                disabled={isPending}
                onClick={() => toggleSource(s.id, !s.is_active)}
                className={[
                  "w-10 h-6 rounded-full relative transition",
                  s.is_active ? "bg-emerald-500" : "bg-slate-300",
                  isPending ? "opacity-60 cursor-not-allowed" : "opacity-100",
                ].join(" ")}
                title={s.is_active ? "Désactiver" : "Activer"}
              >
                <span
                  className={[
                    "absolute top-0.5 w-5 h-5 bg-white rounded-full transition",
                    s.is_active ? "left-4" : "left-0.5",
                  ].join(" ")}
                />
              </button>
            </div>

            <div className="col-span-4 font-medium">{s.name}</div>
            <div className="col-span-1 text-xs font-semibold">{s.type}</div>

            <div className="col-span-6">
              <a href={s.url} target="_blank" rel="noreferrer" className="underline text-slate-700 break-all">
                {s.url}
              </a>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
