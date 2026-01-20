import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";

const schema = z.object({
  id: z.string().min(1),
  assigned_to: z.string().nullable().optional(),
  priority: z.enum(["LOW", "NORMAL", "HIGH"]).nullable().optional(),
  note: z.string().nullable().optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const supabase = supabaseServer();

    const { id, assigned_to, priority, note } = parsed.data;

    const { error } = await supabase
      .from("opportunities")
      .update({
        assigned_to: assigned_to ?? null,
        priority: priority ?? null,
        note: note ?? null,
        processed_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
