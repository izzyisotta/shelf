import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

// E5: thumbs feedback on AI picks. Stored inside the cached recommendation
// JSONB (owner-only under RLS) as recommendation.feedback = { "title|category":
// "up" | "down" } - no schema change needed, and generation prompts read it
// back so future picks learn from it.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const { title, category, verdict, friendId } = await req.json();
  if (!title || !category || !["up", "down", "clear"].includes(verdict)) {
    return NextResponse.json({ error: "title, category, verdict (up/down/clear) required" }, { status: 400 });
  }

  const key = `${String(title).toLowerCase()}|${category}`;

  if (friendId) {
    const { data: row } = await supabase
      .from("match_recommendations")
      .select("recommendation")
      .eq("user_id", user.id)
      .eq("friend_id", friendId)
      .single();
    if (!row) return NextResponse.json({ error: "No cached recommendation" }, { status: 404 });
    const rec = row.recommendation || {};
    rec.feedback = rec.feedback || {};
    if (verdict === "clear") delete rec.feedback[key];
    else rec.feedback[key] = verdict;
    await supabase
      .from("match_recommendations")
      .update({ recommendation: rec })
      .eq("user_id", user.id)
      .eq("friend_id", friendId);
  } else {
    const { data: row } = await supabase
      .from("personal_recommendations")
      .select("recommendation")
      .eq("user_id", user.id)
      .single();
    if (!row) return NextResponse.json({ error: "No cached recommendation" }, { status: 404 });
    const rec = row.recommendation || {};
    rec.feedback = rec.feedback || {};
    if (verdict === "clear") delete rec.feedback[key];
    else rec.feedback[key] = verdict;
    await supabase
      .from("personal_recommendations")
      .update({ recommendation: rec })
      .eq("user_id", user.id);
  }

  return NextResponse.json({ ok: true });
}
