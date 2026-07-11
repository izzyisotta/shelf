import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const friendId = req.nextUrl.searchParams.get("friendId");
  if (!friendId) return NextResponse.json({ error: "friendId required" }, { status: 400 });

  const { data: saved } = await supabase
    .from("match_recommendations")
    .select("recommendation, created_at")
    .eq("user_id", user.id)
    .eq("friend_id", friendId)
    .single();

  if (saved) {
    return NextResponse.json({ recommendation: saved.recommendation, created_at: saved.created_at });
  }

  return NextResponse.json({ recommendation: null });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const { friendId } = await req.json();
  if (!friendId) return NextResponse.json({ error: "friendId required" }, { status: 400 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI recommendations not configured" }, { status: 500 });
  }

  const [myProfile, friendProfile, myResult, theirResult] = await Promise.all([
    supabase.from("profiles").select("username, display_name").eq("id", user.id).single(),
    supabase.from("profiles").select("username, display_name").eq("id", friendId).single(),
    supabase.from("items").select("category, title, creator, rank").eq("user_id", user.id).order("rank"),
    supabase.from("items").select("category, title, creator, rank").eq("user_id", friendId).order("rank"),
  ]);

  const myName = myProfile.data?.display_name || myProfile.data?.username || "You";
  const friendName = friendProfile.data?.display_name || friendProfile.data?.username || "Friend";
  const myItems = myResult.data || [];
  const theirItems = theirResult.data || [];

  const formatList = (items: { rank: number; category: string; title: string; creator: string }[]) =>
    items.map((i) => `${i.rank}. [${i.category}] ${i.title}${i.creator ? ` by ${i.creator}` : ""}`).join("\n");

  const prompt = `You're a cultural taste analyst. Two friends have shared their ranked favorite books, films, and TV shows. Analyze their taste and make recommendations.

${myName}'s ranked favorites:
${formatList(myItems) || "(no items yet)"}

${friendName}'s ranked favorites:
${formatList(theirItems) || "(no items yet)"}

Return a JSON object with exactly this structure. No markdown, no emojis, just clean text. Be specific and reference actual titles. Keep each description to 1-2 sentences max.

{
  "vibe": "A single punchy sentence capturing their shared cultural vibe",
  "common_ground": ["3-4 short observations about what their tastes have in common"],
  "differences": ["2-3 short observations about interesting differences in their taste"],
  "from_their_list": [
    {"title": "Title", "category": "book/film/tv", "reason": "Why ${myName} would enjoy this from ${friendName}'s list"}
  ],
  "new_picks": [
    {"title": "Title", "creator": "Author/Director", "category": "book/film/tv", "reason": "Why both would enjoy this"}
  ]
}

Return 3-5 items in from_their_list and 3-5 in new_picks, spread across the categories they both have items in (don't return all-films if they also share books or TV). Use their actual names. Return ONLY valid JSON, no other text.`;

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
      recommendation = { vibe: text, common_ground: [], differences: [], from_their_list: [], new_picks: [] };
    }

    // Save to database (upsert)
    await supabase
      .from("match_recommendations")
      .upsert({
        user_id: user.id,
        friend_id: friendId,
        recommendation,
        created_at: new Date().toISOString(),
      }, { onConflict: "user_id,friend_id" });

    return NextResponse.json({ recommendation, created_at: new Date().toISOString() });
  } catch (err) {
    return NextResponse.json({
      error: `Could not generate recommendations: ${err instanceof Error ? err.message : "Unknown error"}`,
    }, { status: 500 });
  }
}
