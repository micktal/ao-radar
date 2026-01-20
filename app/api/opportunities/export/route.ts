import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";

function csvEscape(v: any) {
  const s = (v ?? "").toString();
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const minScore = Number(url.searchParams.get("minScore") ?? "30");
  const status = url.searchParams.get("status"); // optional

  const supabase = supabaseServer();

  let q = supabase
    .from("opportunities")
    .select("title,url,score,status,tags,published_at,assigned_to,priority,note,created_at")
    .gte("score", isNaN(minScore) ? 30 : minScore)
    .order("score", { ascending: false })
    .limit(2000);

  if (status && status !== "ALL") {
    q = q.eq("status", status);
  }

  const { data, error } = await q;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const headers = [
    "title",
    "url",
    "score",
    "status",
    "tags",
    "published_at",
    "assigned_to",
    "priority",
    "note",
    "created_at",
  ];

  const lines = [
    headers.join(","),
    ...(data ?? []).map((r: any) =>
      [
        csvEscape(r.title),
        csvEscape(r.url),
        csvEscape(r.score),
        csvEscape(r.status),
        csvEscape((r.tags ?? []).join("|")),
        csvEscape(r.published_at ?? ""),
        csvEscape(r.assigned_to ?? ""),
        csvEscape(r.priority ?? ""),
        csvEscape(r.note ?? ""),
        csvEscape(r.created_at ?? ""),
      ].join(",")
    ),
  ];

  const csv = lines.join("\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ao-radar-export.csv"`,
    },
  });
}
