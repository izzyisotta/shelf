import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

// Username-only import: fetch a user's PUBLIC Letterboxd films/watchlist or
// Goodreads shelves (via their RSS feeds) server-side, no credentials ever.
// Returns rows in the same shape the CSV parsers produce; the client then
// runs them through the existing match -> preview -> commit flow.

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

interface Row {
  title: string;
  creator?: string;
  year?: string;
  rating?: number | null;
  toUpNext?: boolean;
}

async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "en-GB,en;q=0.9",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Upgrade-Insecure-Requests": "1",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[import/profile] ${res.status} for ${url}`, JSON.stringify([...res.headers]).slice(0, 400), body.slice(0, 200));
    throw new Error(`${res.status}`);
  }
  return res.text();
}

function parseLetterboxdGrid(html: string, toUpNext: boolean): Row[] {
  const items = html.match(/<li class="griditem">[\s\S]*?<\/li>/g) || [];
  const rows: Row[] = [];
  for (const li of items) {
    const name = li.match(/data-item-full-display-name="([^"]+)"/)?.[1];
    if (!name) continue;
    const parts = name.match(/^(.*?)\s*\((\d{4})\)\s*$/);
    const rated = li.match(/rated-(\d+)/)?.[1];
    rows.push({
      title: decodeEntities(parts ? parts[1] : name),
      year: parts ? parts[2] : "",
      rating: rated ? Number(rated) / 2 : null,
      toUpNext,
    });
  }
  return rows;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchLetterboxd(username: string): Promise<{ rows: Row[]; partial: boolean }> {
  const user = username.toLowerCase().replace(/[^a-z0-9_]/g, "");
  if (!user) throw new Error("That doesn't look like a Letterboxd username");

  const rows: Row[] = [];
  let partial = false;

  // Rated/watched films, 72 per page. Cloudflare challenges rapid paging,
  // so pace the requests and settle for a partial import if challenged.
  for (let page = 1; page <= 7; page++) {
    if (page > 1) await sleep(1200 + Math.floor(500 * (page / 7)));
    try {
      const html = await fetchPage(
        `https://letterboxd.com/${user}/films/${page > 1 ? `page/${page}/` : ""}`
      );
      const pageRows = parseLetterboxdGrid(html, false);
      rows.push(...pageRows);
      if (pageRows.length < 72) break;
    } catch (err) {
      if (page === 1) throw err; // profile missing/private - real error
      partial = true;
      break;
    }
  }

  // Watchlist -> Up Next
  for (let page = 1; page <= 2; page++) {
    await sleep(1200);
    try {
      const html = await fetchPage(
        `https://letterboxd.com/${user}/watchlist/${page > 1 ? `page/${page}/` : ""}`
      );
      const pageRows = parseLetterboxdGrid(html, true);
      rows.push(...pageRows);
      if (pageRows.length < 72) break;
    } catch {
      break; // private or empty watchlist - fine
    }
  }
  return { rows, partial };
}

function parseGoodreadsRss(xml: string, toUpNext: boolean): Row[] {
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
  return items
    .map((item) => {
      const grab = (tag: string) =>
        item.match(new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`))?.[1]?.trim() || "";
      const rating = Number(grab("user_rating"));
      return {
        // Strip series suffix like "Dune (Dune, #1)"
        title: grab("title").replace(/\s*\([^)]*#\d+[^)]*\)\s*$/, ""),
        creator: grab("author_name"),
        rating: rating > 0 ? rating : null,
        toUpNext,
      };
    })
    .filter((r) => r.title);
}

async function fetchGoodreads(input: string): Promise<Row[]> {
  // Accept a numeric ID or a profile URL like goodreads.com/user/show/12345-name
  const id =
    input.match(/(?:user\/show\/|list_rss\/)(\d+)/)?.[1] ||
    input.trim().match(/^(\d+)$/)?.[1];
  if (!id) {
    throw new Error(
      "Paste your Goodreads profile URL (goodreads.com/user/show/...) or numeric user ID"
    );
  }

  const rows: Row[] = [];
  for (let page = 1; page <= 4; page++) {
    if (page > 1) await sleep(800);
    const xml = await fetchPage(
      `https://www.goodreads.com/review/list_rss/${id}?shelf=read&page=${page}`
    );
    const pageRows = parseGoodreadsRss(xml, false);
    rows.push(...pageRows);
    if (pageRows.length === 0) break;
  }
  for (let page = 1; page <= 2; page++) {
    await sleep(800);
    const xml = await fetchPage(
      `https://www.goodreads.com/review/list_rss/${id}?shelf=to-read&page=${page}`
    );
    const pageRows = parseGoodreadsRss(xml, true);
    rows.push(...pageRows);
    if (pageRows.length === 0) break;
  }
  return rows;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const { service, username } = await req.json();
  if (!username || typeof username !== "string") {
    return NextResponse.json({ error: "Username required" }, { status: 400 });
  }

  try {
    let rows: Row[];
    let partial = false;
    if (service === "letterboxd") {
      const result = await fetchLetterboxd(username.trim());
      rows = result.rows;
      partial = result.partial;
    } else if (service === "goodreads") {
      rows = await fetchGoodreads(username.trim());
    } else {
      return NextResponse.json({ error: "service must be letterboxd or goodreads" }, { status: 400 });
    }

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Nothing found - is the profile public and the name spelled right?" },
        { status: 404 }
      );
    }

    return NextResponse.json({ rows: rows.slice(0, 500), partial });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "fetch failed";
    if (msg === "404") {
      return NextResponse.json({ error: "Profile not found - check the spelling" }, { status: 404 });
    }
    return NextResponse.json(
      { error: `Couldn't fetch that profile (${msg}). If it's private, use the CSV export instead.` },
      { status: 502 }
    );
  }
}
