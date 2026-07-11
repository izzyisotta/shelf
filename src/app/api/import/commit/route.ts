import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

interface CommitItem {
  title: string;
  creator?: string;
  year?: string;
  coverUrl?: string;
  externalId?: string;
  rating?: number | null;
  toUpNext?: boolean;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const { category, items } = (await req.json()) as { category: string; items: CommitItem[] };

  if (!["book", "film", "tv"].includes(category) || !Array.isArray(items)) {
    return NextResponse.json({ error: "category (book/film/tv) and items required" }, { status: 400 });
  }
  if (items.length > 500) {
    return NextResponse.json({ error: "Max 500 items per import" }, { status: 400 });
  }

  // What's already in the Trove and Up Next (skip duplicates, enforce pipeline)
  const [{ data: existing }, { data: existingUpNext }] = await Promise.all([
    supabase.from("items").select("title, rank").eq("user_id", user.id).eq("category", category),
    supabase.from("recommended").select("title").eq("user_id", user.id).eq("category", category),
  ]);

  const inTrove = new Set((existing || []).map((i) => i.title.toLowerCase()));
  const inUpNext = new Set((existingUpNext || []).map((i) => i.title.toLowerCase()));
  let nextRank = Math.max(0, ...(existing || []).map((i) => i.rank)) + 1;

  const troveBound = items
    .filter((i) => !i.toUpNext && !inTrove.has(i.title.toLowerCase()))
    // Highest-rated first so imported ranking reflects the source ratings
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));

  const upNextBound = items.filter(
    (i) =>
      i.toUpNext &&
      !inTrove.has(i.title.toLowerCase()) &&
      !inUpNext.has(i.title.toLowerCase())
  );

  let addedTrove = 0;
  let addedUpNext = 0;

  if (troveBound.length > 0) {
    const rows = troveBound.map((i) => ({
      user_id: user.id,
      category,
      title: i.title,
      creator: i.creator || "",
      year: i.year || "",
      cover_url: i.coverUrl || "",
      rank: nextRank++,
      external_id: i.externalId || "",
    }));
    const { error } = await supabase.from("items").insert(rows);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    addedTrove = rows.length;
  }

  if (upNextBound.length > 0) {
    const rows = upNextBound.map((i) => ({
      user_id: user.id,
      category,
      title: i.title,
      creator: i.creator || "",
      source: "Imported",
      notes: "",
    }));
    const { error } = await supabase.from("recommended").insert(rows);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    addedUpNext = rows.length;
  }

  const skipped = items.length - addedTrove - addedUpNext;
  return NextResponse.json({ ok: true, addedTrove, addedUpNext, skipped });
}
