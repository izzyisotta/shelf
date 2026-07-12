import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { isMissingTable, NEEDS_MIGRATION } from "@/lib/groups";

// List my groups / create a group (F9)
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const { data: memberships, error } = await supabase
    .from("group_members")
    .select("group_id")
    .eq("user_id", user.id);

  if (error) {
    if (isMissingTable(error)) return NextResponse.json({ groups: [], ...NEEDS_MIGRATION });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const ids = (memberships || []).map((m) => m.group_id);
  if (ids.length === 0) return NextResponse.json({ groups: [] });

  const [{ data: groups }, { data: members }] = await Promise.all([
    supabase.from("groups").select("id, name, created_by, created_at").in("id", ids),
    supabase.from("group_members").select("group_id, user_id").in("group_id", ids),
  ]);

  const counts = new Map<string, number>();
  for (const m of members || []) counts.set(m.group_id, (counts.get(m.group_id) || 0) + 1);

  return NextResponse.json({
    groups: (groups || [])
      .map((g) => ({ ...g, memberCount: counts.get(g.id) || 1 }))
      .sort((a, b) => b.created_at.localeCompare(a.created_at)),
  });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const { name, memberIds } = await req.json();
  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Group name required" }, { status: 400 });
  }

  const { data: group, error } = await supabase
    .from("groups")
    .insert({ name: name.trim().slice(0, 60), created_by: user.id })
    .select()
    .single();

  if (error) {
    if (isMissingTable(error)) return NextResponse.json(NEEDS_MIGRATION, { status: 503 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = [
    { group_id: group.id, user_id: user.id, added_by: user.id },
    ...([...new Set((memberIds || []) as string[])]
      .filter((id) => id !== user.id)
      .map((id) => ({ group_id: group.id, user_id: id, added_by: user.id }))),
  ];
  const { error: memberError } = await supabase.from("group_members").insert(rows);
  if (memberError) return NextResponse.json({ error: memberError.message }, { status: 500 });

  return NextResponse.json({ ok: true, group });
}
