import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI import not configured" }, { status: 500 });
  }

  const { text } = await req.json();
  if (!text || typeof text !== "string" || text.trim().length < 3) {
    return NextResponse.json({ error: "Paste some text first" }, { status: 400 });
  }
  if (text.length > 20000) {
    return NextResponse.json({ error: "Text too long (20,000 character limit)" }, { status: 400 });
  }

  const prompt = `Extract every book, film, and TV show mentioned in the text below. The text might be a notes-app list, a message thread, a blog post, or anything else unstructured.

Rules:
- Only include actual titles of books, films, or TV shows. Skip music, games, podcasts, people, and vague references you can't pin to a real title.
- If the author or director is stated or you know it with confidence, include it; otherwise leave creator empty.
- If the same title appears twice, include it once.
- If a rating or strength of feeling is attached (stars, "loved", "10/10"), convert it to a 1-5 number in "rating"; otherwise null.

Text:
"""
${text}
"""

Return ONLY a JSON object, no other text:
{"items": [{"title": "...", "creator": "", "category": "book|film|tv", "rating": null}]}`;

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
        max_tokens: 3000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await res.json();
    const raw = data.content?.[0]?.text || "";
    const clean = raw.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();

    let parsed: { items?: { title: string; creator?: string; category?: string; rating?: number | null }[] };
    try {
      parsed = JSON.parse(clean);
    } catch {
      return NextResponse.json({ error: "Couldn't parse anything from that text" }, { status: 422 });
    }

    const items = (parsed.items || [])
      .filter((i) => i.title && ["book", "film", "tv"].includes(i.category || ""))
      .slice(0, 200);

    return NextResponse.json({ items });
  } catch (err) {
    return NextResponse.json({
      error: `Extraction failed: ${err instanceof Error ? err.message : "unknown error"}`,
    }, { status: 500 });
  }
}
