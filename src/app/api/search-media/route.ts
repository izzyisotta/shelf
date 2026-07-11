import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { searchByCategory, MediaResult } from "@/lib/media-search";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const query = req.nextUrl.searchParams.get("q") || "";
  const category = req.nextUrl.searchParams.get("category") || "book";

  if (!query || query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const results: MediaResult[] = await searchByCategory(category, query);

  return NextResponse.json({ results });
}
