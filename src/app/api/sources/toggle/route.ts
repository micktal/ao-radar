import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const source_id = body?.source_id as string | undefined;
    const is_active = body?.is_active as boolean | undefined;

    if (!source_id || typeof is_active !== "boolean") {
      return NextResponse.json({ error: "source_id or is_active missing" }, { status: 400 });
    }

    const supabase = supabaseServer();

    const { error } = await supabase.from("sources").update({ is_active }).eq("id", source_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "server error" }, { status: 500 });
  }
}
