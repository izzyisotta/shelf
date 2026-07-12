const TMDB_KEY = process.env.TMDB_API_KEY || "";

export interface MediaResult {
  title: string;
  creator: string;
  year: string;
  coverUrl: string;
  externalId: string;
}

export async function searchBooks(query: string): Promise<MediaResult[]> {
  const res = await fetch(
    `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=8`
  );
  const data = await res.json();

  return (data.docs || []).slice(0, 8).map((doc: Record<string, unknown>) => ({
    title: doc.title as string,
    creator: ((doc.author_name as string[]) || [])[0] || "Unknown",
    year: String(doc.first_publish_year || ""),
    coverUrl: doc.cover_i
      ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
      : "",
    externalId: (doc.key as string) || "",
  }));
}

export async function searchFilms(query: string): Promise<MediaResult[]> {
  if (!TMDB_KEY) return [];
  const res = await fetch(
    `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_KEY}&query=${encodeURIComponent(query)}&page=1`
  );
  const data = await res.json();

  return (data.results || []).slice(0, 8).map((m: Record<string, unknown>) => ({
    title: m.title as string,
    creator: "",
    year: ((m.release_date as string) || "").slice(0, 4),
    coverUrl: m.poster_path
      ? `https://image.tmdb.org/t/p/w200${m.poster_path}`
      : "",
    externalId: `tmdb:${m.id}`,
  }));
}

export async function searchTV(query: string): Promise<MediaResult[]> {
  if (!TMDB_KEY) return [];
  const res = await fetch(
    `https://api.themoviedb.org/3/search/tv?api_key=${TMDB_KEY}&query=${encodeURIComponent(query)}&page=1`
  );
  const data = await res.json();

  return (data.results || []).slice(0, 8).map((m: Record<string, unknown>) => ({
    title: m.name as string,
    creator: "",
    year: ((m.first_air_date as string) || "").slice(0, 4),
    coverUrl: m.poster_path
      ? `https://image.tmdb.org/t/p/w200${m.poster_path}`
      : "",
    externalId: `tmdb:${m.id}`,
  }));
}

export function searchByCategory(category: string, query: string): Promise<MediaResult[]> {
  if (category === "book") return searchBooks(query);
  if (category === "film") return searchFilms(query);
  if (category === "tv") return searchTV(query);
  return Promise.resolve([]);
}

// Verify AI-generated picks against the real media databases: attach
// external_id/cover for titles that exist, drop the ones that don't
// (hallucination filter, E6). Mutation-free; returns a new array.
export async function verifyPicks<T extends { title: string; creator?: string; category: string }>(
  picks: T[]
): Promise<(T & { externalId: string; coverUrl: string; year: string })[]> {
  const verified: (T & { externalId: string; coverUrl: string; year: string })[] = [];
  const BATCH = 5;
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();

  for (let i = 0; i < picks.length; i += BATCH) {
    const batch = picks.slice(i, i + BATCH);
    const results = await Promise.all(
      batch.map(async (pick) => {
        try {
          const query =
            pick.category === "book" && pick.creator ? `${pick.title} ${pick.creator}` : pick.title;
          const hits = await searchByCategory(pick.category, query);
          const best =
            hits.find((h) => norm(h.title) === norm(pick.title)) ||
            (hits[0] && norm(hits[0].title).includes(norm(pick.title)) ? hits[0] : null);
          if (!best) return null;
          return {
            ...pick,
            title: best.title,
            creator: pick.creator || best.creator,
            externalId: best.externalId,
            coverUrl: best.coverUrl,
            year: best.year,
          };
        } catch {
          // Verification unavailable (API hiccup): keep the pick, unverified
          return { ...pick, externalId: "", coverUrl: "", year: "" };
        }
      })
    );
    verified.push(...results.filter((r): r is NonNullable<typeof r> => r !== null));
  }
  return verified;
}
