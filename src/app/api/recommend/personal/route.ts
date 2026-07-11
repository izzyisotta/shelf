import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const { data: saved } = await supabase
    .from("personal_recommendations")
    .select("recommendation, created_at")
    .eq("user_id", user.id)
    .single();

  if (saved) {
    return NextResponse.json({ recommendation: saved.recommendation, created_at: saved.created_at });
  }

  return NextResponse.json({ recommendation: null });
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI recommendations not configured" }, { status: 500 });
  }

  // Get user's ranked items
  const { data: items } = await supabase
    .from("items")
    .select("category, title, creator, rank")
    .eq("user_id", user.id)
    .order("rank");

  const myItems = items || [];
  if (myItems.length < 3) {
    return NextResponse.json({ error: "Add at least 3 items to your shelf first" }, { status: 400 });
  }

  // Also get their to-consume list to avoid duplicates
  const { data: recommended } = await supabase
    .from("recommended")
    .select("title, category")
    .eq("user_id", user.id);

  const existingTitles = new Set([
    ...myItems.map((i) => `${i.title.toLowerCase()}|${i.category}`),
    ...(recommended || []).map((r) => `${(r.title as string).toLowerCase()}|${r.category}`),
  ]);

  const formatList = (items: { rank: number; category: string; title: string; creator: string }[]) =>
    items.map((i) => `${i.rank}. [${i.category}] ${i.title}${i.creator ? ` by ${i.creator}` : ""}${i.rank <= 12 ? " (top-tier favourite)" : ""}`).join("\n");

  const prompt = `You're a cultural taste analyst. Based on this person's ranked favorite books, films, and TV shows, analyze their taste and suggest things they'd love.

Their ranked favorites:
${formatList(myItems)}

Items already on their list (do NOT suggest these):
${[...existingTitles].map((t) => t.split("|").join(" - ")).join(", ")}

Return a JSON object with exactly this structure. No markdown, no emojis, just clean text. Be specific and reference actual titles from their list. Keep descriptions to 1-2 sentences.

{
  "taste_profile": "A 2-3 sentence analysis of their cultural taste, what themes and styles they gravitate toward",
  "picks": [
    {"title": "Title", "creator": "Author/Director", "category": "book/film/tv", "reason": "Why they'd love this based on their taste"}
  ]
}

Return 3-4 picks for EACH category the person has ranked items in (book/film/tv), so every populated category gets its own recommendations. Skip categories they have no items in. Return ONLY valid JSON, no other text.`;

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
      recommendation = { taste_profile: text, picks: [] };
    }

    // Upsert to database
    const { error: upsertError } = await supabase
      .from("personal_recommendations")
      .upsert({
        user_id: user.id,
        recommendation,
        created_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

    if (upsertError) {
      // If upsert fails (table might not exist yet), still return the recommendation
      console.error("Failed to cache personal recommendation:", upsertError.message);
    }

    return NextResponse.json({ recommendation, created_at: new Date().toISOString() });
  } catch (err) {
    return NextResponse.json({
      error: `Could not generate recommendations: ${err instanceof Error ? err.message : "Unknown error"}`,
    }, { status: 500 });
  }
}
