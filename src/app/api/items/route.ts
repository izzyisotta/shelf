import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const userId = req.nextUrl.searchParams.get("userId") || user.id;
  const category = req.nextUrl.searchParams.get("category");

  let query = supabase
    .from("items")
    .select("*")
    .eq("user_id", userId)
    .order("rank", { ascending: true });

  if (category) {
    query = query.eq("category", category);
  }

  const { data: items, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: items || [] });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const { category, title, creator, year, coverUrl, externalId } = await req.json();

  if (!category || !title) {
    return NextResponse.json({ error: "Category and title required" }, { status: 400 });
  }

  // Get max rank
  const { data: maxItems } = await supabase
    .from("items")
    .select("rank")
    .eq("user_id", user.id)
    .eq("category", category)
    .order("rank", { ascending: false })
    .limit(1);

  const rank = (maxItems?.[0]?.rank || 0) + 1;

  const { data: item, error } = await supabase
    .from("items")
    .insert({
      user_id: user.id,
      category,
      title,
      creator: creator || "",
      year: year || "",
      cover_url: coverUrl || "",
      rank,
      external_id: externalId || "",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Pipeline direction: landing in the Trove clears the item from Up Next
  await supabase
    .from("recommended")
    .delete()
    .eq("user_id", user.id)
    .eq("category", category)
    .ilike("title", title);

  return NextResponse.json({ ok: true, item });
}

export async function PUT(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const { items } = await req.json();
  if (!Array.isArray(items)) {
    return NextResponse.json({ error: "Items array required" }, { status: 400 });
  }

  for (const item of items) {
    await supabase
      .from("items")
      .update({ rank: item.rank })
      .eq("id", item.id)
      .eq("user_id", user.id);
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "Item id required" }, { status: 400 });

  const { data: deleted } = await supabase
    .from("items")
    .select("category")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  await supabase.from("items").delete().eq("id", id).eq("user_id", user.id);

  // Compact ranks so the remaining items stay 1..n with no gaps
  if (deleted?.category) {
    const { data: remaining } = await supabase
      .from("items")
      .select("id, rank")
      .eq("user_id", user.id)
      .eq("category", deleted.category)
      .order("rank", { ascending: true });

    for (let i = 0; i < (remaining?.length || 0); i++) {
      if (remaining![i].rank !== i + 1) {
        await supabase
          .from("items")
          .update({ rank: i + 1 })
          .eq("id", remaining![i].id)
          .eq("user_id", user.id);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
