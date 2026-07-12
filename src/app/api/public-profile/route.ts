import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

// Public teaser for the shareable comparison link (/join/[username]).
// Profiles and items are world-readable under RLS, so no auth required.
export async function GET(req: NextRequest) {
  const username = (req.nextUrl.searchParams.get("username") || "").toLowerCase();
  if (!username) return NextResponse.json({ error: "username required" }, { status: 400 });

  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name")
    .eq("username", username)
    .single();

  if (!profile) return NextResponse.json({ error: "No such user" }, { status: 404 });

  const { data: items } = await supabase
    .from("items")
    .select("category, title, creator, cover_url, rank")
    .eq("user_id", profile.id)
    .order("rank", { ascending: true });

  const all = items || [];
  const counts = {
    book: all.filter((i) => i.category === "book").length,
    film: all.filter((i) => i.category === "film").length,
    tv: all.filter((i) => i.category === "tv").length,
  };
  // Top few covers for the teaser
  const top = all.filter((i) => i.rank <= 4 && i.cover_url).slice(0, 8);

  return NextResponse.json({
    username: profile.username,
    displayName: profile.display_name || profile.username,
    counts,
    top,
  });
}
