import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireAdmin } from "@/lib/auth/requireAdmin";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    // ✅ RBAC admin obligatoire
    const guard = await requireAdmin();
    if (!guard.ok) {
      return NextResponse.json(
        { error: guard.error ?? "unauthorized" },
        { status: guard.status ?? 401 }
      );
    }

    // ✅ Body
    const body = await req.json().catch(() => null);

    const source_id = (body?.source_id ?? "") as string;
    const is_active = body?.is_active as boolean;

    if (!source_id || typeof source_id !== "string") {
      return NextResponse.json({ error: "source_id missing" }, { status: 400 });
    }

    if (typeof is_active !== "boolean") {
      return NextResponse.json({ error: "is_active missing" }, { status: 400 });
    }

    const supabase = supabaseServer();

    // ✅ Update
    const { error } = await supabase.from("sources").update({ is_active }).eq("id", source_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, source_id, is_active });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "server error" }, { status: 500 });
  }
}
