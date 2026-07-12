import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { isMissingTable, NEEDS_MIGRATION } from "@/lib/groups";

// Group detail: roster, chat, latest AI pick (F10 lives here too)
export async function GET(req: NextRequest, ctx: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const { data: group, error } = await supabase
    .from("groups")
    .select("id, name, created_by, created_at")
    .eq("id", groupId)
    .single();

  if (error) {
    if (isMissingTable(error)) return NextResponse.json(NEEDS_MIGRATION, { status: 503 });
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }

  const [{ data: memberRows }, { data: messages }, { data: picks }] = await Promise.all([
    supabase.from("group_members").select("user_id").eq("group_id", groupId),
    supabase
      .from("group_messages")
      .select("id, author_id, body, created_at")
      .eq("group_id", groupId)
      .order("created_at", { ascending: true })
      .limit(100),
    supabase
      .from("group_picks")
      .select("id, requested_by, constraints_text, recommendation, created_at")
      .eq("group_id", groupId)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  const memberIds = (memberRows || []).map((m) => m.user_id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, display_name")
    .in("id", memberIds.length > 0 ? memberIds : ["00000000-0000-0000-0000-000000000000"]);

  const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

  return NextResponse.json({
    group,
    members: memberIds.map((id) => profileMap.get(id)).filter(Boolean),
    messages: (messages || []).map((m) => ({
      ...m,
      author: profileMap.get(m.author_id) || { username: "unknown", display_name: "Unknown" },
    })),
    latestPick: picks?.[0] || null,
    isMember: memberIds.includes(user.id),
  });
}

// Send a chat message
export async function POST(req: NextRequest, ctx: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const { body } = await req.json();
  if (!body || !body.trim()) return NextResponse.json({ error: "Message required" }, { status: 400 });

  const { data: message, error } = await supabase
    .from("group_messages")
    .insert({ group_id: groupId, author_id: user.id, body: body.trim().slice(0, 2000) })
    .select()
    .single();

  if (error) {
    if (isMissingTable(error)) return NextResponse.json(NEEDS_MIGRATION, { status: 503 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, message });
}

// Leave the group (creator leaving deletes it if they're the last member)
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  await supabase.from("group_members").delete().eq("group_id", groupId).eq("user_id", user.id);

  const { data: remaining } = await supabase
    .from("group_members")
    .select("user_id")
    .eq("group_id", groupId)
    .limit(1);
  if (!remaining || remaining.length === 0) {
    await supabase.from("groups").delete().eq("id", groupId);
  }

  return NextResponse.json({ ok: true });
}
