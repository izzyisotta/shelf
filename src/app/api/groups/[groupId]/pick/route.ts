import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { verifyPicks } from "@/lib/media-search";
import { isMissingTable, NEEDS_MIGRATION } from "@/lib/groups";

// Group AI picks (E3): Claude reads every member's ranked Trove and finds
// something nobody has consumed that the whole group will enjoy, honouring
// optional constraints ("something short and funny", "under 300 pages").
export async function POST(req: NextRequest, ctx: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI picks not configured" }, { status: 500 });

  const { constraints } = await req.json();

  const { data: memberRows, error } = await supabase
    .from("group_members")
    .select("user_id")
    .eq("group_id", groupId);

  if (error) {
    if (isMissingTable(error)) return NextResponse.json(NEEDS_MIGRATION, { status: 503 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const memberIds = (memberRows || []).map((m) => m.user_id);
  if (!memberIds.includes(user.id)) {
    return NextResponse.json({ error: "Not a member of this group" }, { status: 403 });
  }

  const [{ data: profiles }, { data: items }] = await Promise.all([
    supabase.from("profiles").select("id, username, display_name").in("id", memberIds),
    supabase
      .from("items")
      .select("user_id, category, title, creator, rank")
      .in("user_id", memberIds)
      .order("rank"),
  ]);

  const nameOf = new Map((profiles || []).map((p) => [p.id, p.display_name || p.username]));
  const byMember = memberIds.map((id) => {
    const theirs = (items || []).filter((i) => i.user_id === id).slice(0, 40);
    const list = theirs
      .map((i) => `${i.rank}. [${i.category}] ${i.title}${i.creator ? ` by ${i.creator}` : ""}${i.rank <= 12 ? " (top-tier)" : ""}`)
      .join("\n");
    return `${nameOf.get(id) || "Member"}:\n${list || "(no items yet)"}`;
  });

  const everyTitle = [...new Set((items || []).map((i) => `${i.title} (${i.category})`))];

  const prompt = `You're picking for a group. ${memberIds.length} friends share their ranked favorite books, films, and TV shows below. Find things NONE of them has consumed that the WHOLE group will enjoy - the overlap of their tastes, not one person's.

${byMember.join("\n\n")}

Already consumed by someone in the group (do NOT suggest any of these):
${everyTitle.join(", ") || "(nothing yet)"}
${constraints?.trim() ? `\nThe group's constraints for this pick (respect them strictly): ${constraints.trim().slice(0, 300)}` : ""}

Return ONLY a JSON object, no markdown, no emojis:
{
  "group_vibe": "One sentence on where these tastes overlap",
  "picks": [
    {"title": "Title", "creator": "Author/Director", "category": "book/film/tv", "reason": "Why this works for everyone, referencing members' actual favourites"}
  ]
}

Return 3-5 picks. If the constraints imply a category (e.g. 'for film night'), stay in it; otherwise spread across categories.`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 1500,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await res.json();
    const raw = data.content?.[0]?.text || "";
    const text = raw.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();

    let recommendation;
    try {
      recommendation = JSON.parse(text);
    } catch {
      return NextResponse.json({ error: "AI returned something unusable, try again" }, { status: 502 });
    }

    if (Array.isArray(recommendation.picks)) {
      recommendation.picks = await verifyPicks(recommendation.picks);
    }

    const { data: saved, error: saveError } = await supabase
      .from("group_picks")
      .insert({
        group_id: groupId,
        requested_by: user.id,
        constraints_text: constraints?.trim().slice(0, 300) || "",
        recommendation,
      })
      .select()
      .single();

    if (saveError) return NextResponse.json({ error: saveError.message }, { status: 500 });
    return NextResponse.json({ ok: true, pick: saved });
  } catch (err) {
    return NextResponse.json(
      { error: `Pick failed: ${err instanceof Error ? err.message : "unknown"}` },
      { status: 500 }
    );
  }
}
