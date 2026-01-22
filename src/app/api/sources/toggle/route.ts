import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireAdmin } from "@/lib/auth/requireAdmin";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const guard = await requireAdmin();
    if (!guard.ok) {
      return NextResponse.json({ error: guard.error }, { status: guard.status });
    }

    const body = await req.json();

    const source_id = body?.source_id as string | undefined;
    const is_active = body?.is_active as boolean | undefined;

    if (!source_id || typeof is_active !== "boolean") {
      return NextResponse.json({ error: "source_id or is_active missing" }, { status: 400 });
    }

    const supabase = supabaseServer();

    const { data, error } = await supabase
      .from("sources")
      .update({ is_active })
      .eq("id", source_id)
      .select("id,is_active")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, source: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "server error" }, { status: 500 });
  }
}
