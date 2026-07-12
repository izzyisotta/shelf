import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

// Redeem a shareable comparison link: create an ACCEPTED friendship with
// the link owner. Sharing the link is the owner's consent, so no pending
// request step.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const { username } = await req.json();
  if (!username) return NextResponse.json({ error: "username required" }, { status: 400 });

  const { data: target } = await supabase
    .from("profiles")
    .select("id, username, display_name")
    .eq("username", username.toLowerCase())
    .single();

  if (!target) return NextResponse.json({ error: "No such user" }, { status: 404 });
  if (target.id === user.id) {
    return NextResponse.json({ error: "That's your own link" }, { status: 400 });
  }

  // Already friends (either direction)?
  const { data: existing } = await supabase
    .from("friendships")
    .select("id, status, requester_id, addressee_id")
    .or(
      `and(requester_id.eq.${user.id},addressee_id.eq.${target.id}),and(requester_id.eq.${target.id},addressee_id.eq.${user.id})`
    )
    .limit(1);

  if (existing && existing.length > 0) {
    const f = existing[0];
    if (f.status !== "accepted" && f.addressee_id === user.id) {
      // They'd requested us before: accept it
      await supabase.from("friendships").update({ status: "accepted" }).eq("id", f.id);
    }
    return NextResponse.json({ ok: true, friendId: target.id, already: true });
  }

  const { error } = await supabase.from("friendships").insert({
    requester_id: user.id,
    addressee_id: target.id,
    status: "accepted",
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, friendId: target.id });
}
