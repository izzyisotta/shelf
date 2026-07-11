import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { searchByCategory, MediaResult } from "@/lib/media-search";

interface ImportRow {
  title: string;
  creator?: string;
  year?: string;
  rating?: number | null;
  toUpNext?: boolean;
}

interface MatchedRow extends ImportRow {
  match: MediaResult | null;
}

function normalise(s: string) {
  return s
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function pickBest(row: ImportRow, results: MediaResult[]): MediaResult | null {
  if (results.length === 0) return null;
  const wantTitle = normalise(row.title);
  const wantYear = (row.year || "").trim();

  // Exact title + year match first, then exact title, then year, then top hit
  const scored = results.map((r) => {
    let score = 0;
    if (normalise(r.title) === wantTitle) score += 2;
    if (wantYear && r.year && Math.abs(Number(r.year) - Number(wantYear)) <= 1) score += 1;
    return { r, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0].r;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const { category, rows } = (await req.json()) as { category: string; rows: ImportRow[] };

  if (!["book", "film", "tv"].includes(category) || !Array.isArray(rows)) {
    return NextResponse.json({ error: "category (book/film/tv) and rows required" }, { status: 400 });
  }
  if (rows.length === 0) return NextResponse.json({ matched: [] });
  if (rows.length > 500) {
    return NextResponse.json({ error: "Max 500 rows per import" }, { status: 400 });
  }

  const matched: MatchedRow[] = [];
  const BATCH = 5;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const results = await Promise.all(
      batch.map(async (row) => {
        try {
          const query = row.creator ? `${row.title} ${row.creator}` : row.title;
          let hits = await searchByCategory(category, query);
          // Books: retry without author if the joint query found nothing
          if (hits.length === 0 && row.creator) {
            hits = await searchByCategory(category, row.title);
          }
          return { ...row, match: pickBest(row, hits) };
        } catch {
          return { ...row, match: null };
        }
      })
    );
    matched.push(...results);
  }

  return NextResponse.json({ matched });
}
