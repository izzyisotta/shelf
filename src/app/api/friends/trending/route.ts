import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

// Trending in your circle (D9): items two or more of your friends added
// in the last 30 days, ranked by how many added them.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const { data: friendships } = await supabase
    .from("friendships")
    .select("requester_id, addressee_id")
    .eq("status", "accepted")
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

  const friendIds = [
    ...new Set(
      (friendships || []).map((f) => (f.requester_id === user.id ? f.addressee_id : f.requester_id))
    ),
  ];
  if (friendIds.length === 0) return NextResponse.json({ trending: [] });

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: items } = await supabase
    .from("items")
    .select("user_id, category, title, creator, cover_url, external_id, created_at")
    .in("user_id", friendIds)
    .gte("created_at", since);

  // Group by title+category, count distinct friends
  const groups = new Map<
    string,
    { title: string; creator: string; category: string; coverUrl: string; externalId: string; users: Set<string>; latest: string }
  >();
  for (const i of items || []) {
    const key = `${i.title.toLowerCase()}|${i.category}`;
    const g = groups.get(key);
    if (g) {
      g.users.add(i.user_id);
      if (i.created_at > g.latest) g.latest = i.created_at;
      if (!g.coverUrl && i.cover_url) g.coverUrl = i.cover_url;
    } else {
      groups.set(key, {
        title: i.title,
        creator: i.creator || "",
        category: i.category,
        coverUrl: i.cover_url || "",
        externalId: i.external_id || "",
        users: new Set([i.user_id]),
        latest: i.created_at,
      });
    }
  }

  const trending = [...groups.values()]
    .filter((g) => g.users.size >= 2)
    .sort((a, b) => b.users.size - a.users.size || b.latest.localeCompare(a.latest))
    .slice(0, 6)
    .map((g) => ({
      title: g.title,
      creator: g.creator,
      category: g.category,
      coverUrl: g.coverUrl,
      externalId: g.externalId,
      count: g.users.size,
    }));

  return NextResponse.json({ trending });
}
