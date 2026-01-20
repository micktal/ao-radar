import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";

const schema = z.object({
  id: z.string().min(1),

  status: z.enum(["NEW", "TRIAGED", "QUALIFIED", "SENT", "WON", "LOST"]).optional(),
  assigned_to: z.string().max(120).nullable().optional(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
  notes: z.string().max(4000).nullable().optional(),
  next_action: z.string().max(500).nullable().optional(),
  deadline_at: z.string().datetime().nullable().optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const supabase = supabaseServer();
    const { id, ...rest } = parsed.data;

    const update: Record<string, any> = {};
    for (const [k, v] of Object.entries(rest)) {
      if (typeof v !== "undefined") update[k] = v;
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const { error } = await supabase.from("opportunities").update(update).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
