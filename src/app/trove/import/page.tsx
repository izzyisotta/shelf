"use client";

import { useState, useRef } from "react";
import { useAuth } from "@/components/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Category = "book" | "film" | "tv";
type Mode = "letterboxd" | "goodreads" | "csv" | "paste";

interface ParsedRow {
  title: string;
  creator?: string;
  year?: string;
  rating?: number | null;
  toUpNext?: boolean;
}

interface MatchedRow extends ParsedRow {
  match: {
    title: string;
    creator: string;
    year: string;
    coverUrl: string;
    externalId: string;
  } | null;
  selected: boolean;
  rowCategory: Category;
}

// Minimal CSV parser that handles quoted fields with commas and escaped quotes
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  row.push(field);
  if (row.some((f) => f.trim() !== "")) rows.push(row);
  return rows;
}

function headerIndex(headers: string[], ...names: string[]): number {
  const lower = headers.map((h) => h.toLowerCase().trim());
  for (const name of names) {
    const i = lower.indexOf(name.toLowerCase());
    if (i !== -1) return i;
  }
  // Fuzzy: contains
  for (const name of names) {
    const i = lower.findIndex((h) => h.includes(name.toLowerCase()));
    if (i !== -1) return i;
  }
  return -1;
}

function parseRows(mode: Mode, csv: string[][]): { rows: ParsedRow[]; error?: string } {
  if (csv.length < 2) return { rows: [], error: "File has no data rows" };
  const headers = csv[0];
  const data = csv.slice(1);

  if (mode === "letterboxd") {
    // ratings.csv / watched.csv / watchlist.csv: Date,Name,Year,Letterboxd URI[,Rating]
    const iName = headerIndex(headers, "name");
    const iYear = headerIndex(headers, "year");
    const iRating = headerIndex(headers, "rating");
    if (iName === -1) return { rows: [], error: "Doesn't look like a Letterboxd export (no Name column)" };
    const isWatchlist = iRating === -1;
    return {
      rows: data.map((r) => ({
        title: r[iName]?.trim() || "",
        year: iYear !== -1 ? r[iYear]?.trim() : "",
        rating: !isWatchlist && r[iRating] ? parseFloat(r[iRating]) : null,
        toUpNext: isWatchlist,
      })).filter((r) => r.title),
    };
  }

  if (mode === "goodreads") {
    const iTitle = headerIndex(headers, "title");
    const iAuthor = headerIndex(headers, "author");
    const iRating = headerIndex(headers, "my rating");
    const iShelf = headerIndex(headers, "exclusive shelf");
    if (iTitle === -1 || iAuthor === -1) {
      return { rows: [], error: "Doesn't look like a Goodreads export (no Title/Author columns)" };
    }
    return {
      rows: data.map((r) => {
        const shelf = iShelf !== -1 ? r[iShelf]?.trim() : "read";
        return {
          // Strip series suffix like "Dune (Dune, #1)"
          title: (r[iTitle] || "").replace(/\s*\([^)]*#\d+[^)]*\)\s*$/, "").trim(),
          creator: r[iAuthor]?.trim() || "",
          rating: iRating !== -1 && r[iRating] ? parseFloat(r[iRating]) : null,
          toUpNext: shelf === "to-read",
        };
      }).filter((r) => r.title && (r.toUpNext || r.rating !== 0)),
    };
  }

  // Generic CSV: find title-ish, creator-ish, year-ish, rating-ish columns
  const iTitle = headerIndex(headers, "title", "name");
  const iCreator = headerIndex(headers, "creator", "author", "director", "by");
  const iYear = headerIndex(headers, "year", "date");
  const iRating = headerIndex(headers, "rating", "score", "stars");
  if (iTitle === -1) {
    return { rows: [], error: `No title column found. Headers seen: ${headers.join(", ")}` };
  }
  return {
    rows: data.map((r) => ({
      title: r[iTitle]?.trim() || "",
      creator: iCreator !== -1 ? r[iCreator]?.trim() : "",
      year: iYear !== -1 ? (r[iYear] || "").match(/\d{4}/)?.[0] || "" : "",
      rating: iRating !== -1 && r[iRating] ? parseFloat(r[iRating]) : null,
    })).filter((r) => r.title),
  };
}

const MODES: { key: Mode; label: string; blurb: string; fixedCategory?: Category }[] = [
  { key: "letterboxd", label: "Letterboxd", blurb: "Just your username - films and watchlist from your public profile. CSV as fallback", fixedCategory: "film" },
  { key: "goodreads", label: "Goodreads", blurb: "Just your profile link - read and to-read shelves. CSV as fallback", fixedCategory: "book" },
  { key: "csv", label: "Any CSV", blurb: "A spreadsheet with a title column; creator, year and rating picked up if present" },
  { key: "paste", label: "Paste a list", blurb: "Any text: a notes-app list, a message thread, a blog post. AI pulls out the titles" },
];

export default function ImportPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<Mode | null>(null);
  const [category, setCategory] = useState<Category>("film");
  const [pasteText, setPasteText] = useState("");
  const [profileInput, setProfileInput] = useState("");
  const [matching, setMatching] = useState(false);
  const [matchProgress, setMatchProgress] = useState("");
  const [rows, setRows] = useState<MatchedRow[]>([]);
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ addedTrove: number; addedUpNext: number; skipped: number } | null>(null);

  if (!loading && !user) {
    router.push("/login");
    return null;
  }

  async function handleFile(file: File) {
    setError("");
    setResult(null);
    setRows([]);
    const text = await file.text();
    const parsed = parseRows(mode!, parseCSV(text));
    if (parsed.error) {
      setError(parsed.error);
      return;
    }
    if (parsed.rows.length === 0) {
      setError("No usable rows found in that file");
      return;
    }
    if (parsed.rows.length > 500) {
      setError(`That's ${parsed.rows.length} rows; the limit is 500 per import. Split the file and run twice.`);
      return;
    }

    await matchAndPreview(parsed.rows);
  }

  async function handleProfileFetch() {
    setError("");
    setResult(null);
    setRows([]);
    setMatching(true);
    setMatchProgress(`Fetching ${mode === "letterboxd" ? "Letterboxd profile" : "Goodreads shelves"}...`);
    try {
      const res = await fetch("/api/import/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service: mode, username: profileInput }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Fetch failed");
        setMatching(false);
        setMatchProgress("");
        return;
      }
      if (data.partial) {
        setError("Got part of the profile before being rate-limited - import these, then fetch again in a few minutes for the rest.");
      }
      await matchAndPreview(data.rows);
    } catch {
      setError("Fetch failed, try again");
      setMatching(false);
      setMatchProgress("");
    }
  }

  async function matchAndPreview(parsedRows: ParsedRow[]) {
    setMatching(true);
    setMatchProgress(`Matching ${parsedRows.length} items against the ${category === "book" ? "book" : "film/TV"} database...`);
    try {
      const res = await fetch("/api/import/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, rows: parsedRows }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Matching failed");
      } else {
        setRows(
          (data.matched || []).map((m: Omit<MatchedRow, "selected" | "rowCategory">) => ({
            ...m,
            selected: m.match !== null,
            rowCategory: category,
          }))
        );
      }
    } catch {
      setError("Matching failed, try again");
    }
    setMatching(false);
    setMatchProgress("");
  }

  async function handleExtract() {
    setError("");
    setResult(null);
    setRows([]);
    setMatching(true);
    setMatchProgress("Extracting titles from your text...");
    try {
      const res = await fetch("/api/import/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: pasteText }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Extraction failed");
        setMatching(false);
        setMatchProgress("");
        return;
      }
      const extracted: { title: string; creator?: string; category: Category; rating?: number | null }[] =
        data.items || [];
      if (extracted.length === 0) {
        setError("No books, films or TV shows found in that text");
        setMatching(false);
        setMatchProgress("");
        return;
      }

      const allRows: MatchedRow[] = [];
      for (const cat of ["book", "film", "tv"] as Category[]) {
        const group = extracted.filter((i) => i.category === cat);
        if (group.length === 0) continue;
        setMatchProgress(`Matching ${group.length} ${cat === "tv" ? "TV shows" : cat + "s"}...`);
        const matchRes = await fetch("/api/import/match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            category: cat,
            rows: group.map((i) => ({ title: i.title, creator: i.creator || "", rating: i.rating ?? null })),
          }),
        });
        const matchData = await matchRes.json();
        if (matchRes.ok) {
          allRows.push(
            ...(matchData.matched || []).map((m: Omit<MatchedRow, "selected" | "rowCategory">) => ({
              ...m,
              selected: m.match !== null,
              rowCategory: cat,
            }))
          );
        }
      }
      setRows(allRows);
    } catch {
      setError("Extraction failed, try again");
    }
    setMatching(false);
    setMatchProgress("");
  }

  async function runImport() {
    const selected = rows.filter((r) => r.selected && r.match);
    if (selected.length === 0) return;
    setImporting(true);
    setError("");
    try {
      const totals = { addedTrove: 0, addedUpNext: 0, skipped: 0 };
      for (const cat of ["book", "film", "tv"] as Category[]) {
        const group = selected.filter((r) => r.rowCategory === cat);
        if (group.length === 0) continue;
        const res = await fetch("/api/import/commit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            category: cat,
            items: group.map((r) => ({
              title: r.match!.title,
              creator: r.match!.creator || r.creator || "",
              year: r.match!.year || r.year || "",
              coverUrl: r.match!.coverUrl,
              externalId: r.match!.externalId,
              rating: r.rating,
              toUpNext: r.toUpNext || false,
            })),
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Import failed");
          setImporting(false);
          return;
        }
        totals.addedTrove += data.addedTrove;
        totals.addedUpNext += data.addedUpNext;
        totals.skipped += data.skipped;
      }
      setResult(totals);
      setRows([]);
    } catch {
      setError("Import failed, try again");
    }
    setImporting(false);
  }

  const selectedCount = rows.filter((r) => r.selected && r.match).length;
  const unmatchedCount = rows.filter((r) => !r.match).length;

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 md:py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-serif text-2xl text-foreground">Import</h1>
        <Link href="/trove" className="text-sm text-muted hover:text-foreground transition-colors">
          Back to My Trove
        </Link>
      </div>

      {/* Mode selection */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {MODES.map((m) => (
          <button
            key={m.key}
            onClick={() => {
              setMode(m.key);
              if (m.fixedCategory) setCategory(m.fixedCategory);
              setRows([]);
              setResult(null);
              setError("");
            }}
            className={`text-left p-4 rounded-xl border transition-colors ${
              mode === m.key
                ? "border-accent bg-accent-muted"
                : "border-border bg-surface hover:bg-surface-hover"
            }`}
          >
            <div className="font-medium text-foreground text-sm mb-1">{m.label}</div>
            <div className="text-xs text-muted">{m.blurb}</div>
          </button>
        ))}
      </div>

      {mode === "paste" && (
        <div className="bg-surface rounded-xl border border-border p-6 mb-6">
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder={"Paste anything: \"my top films: parasite, the bear (tv), currently reading east of eden...\""}
            rows={6}
            className="w-full px-4 py-3 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-light focus:ring-2 focus:ring-accent focus:border-transparent resize-y"
          />
          <div className="flex items-center gap-3 mt-3">
            <button
              onClick={handleExtract}
              disabled={matching || pasteText.trim().length < 3}
              className="px-4 py-2 bg-accent text-background rounded-lg text-sm font-medium hover:bg-accent-hover disabled:opacity-50 transition-colors"
            >
              {matching ? "Working..." : "Extract titles"}
            </button>
            {matchProgress && <span className="text-xs text-muted">{matchProgress}</span>}
          </div>
        </div>
      )}

      {(mode === "letterboxd" || mode === "goodreads") && (
        <div className="bg-surface rounded-xl border border-border p-6 mb-6">
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="text"
              value={profileInput}
              onChange={(e) => setProfileInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && profileInput.trim()) handleProfileFetch(); }}
              placeholder={mode === "letterboxd" ? "Letterboxd username" : "Goodreads profile URL or ID"}
              className="flex-1 min-w-48 px-4 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-light focus:ring-2 focus:ring-accent focus:border-transparent"
            />
            <button
              onClick={handleProfileFetch}
              disabled={matching || !profileInput.trim()}
              className="px-4 py-2 bg-accent text-background rounded-lg text-sm font-medium hover:bg-accent-hover disabled:opacity-50 transition-colors"
            >
              {matching ? "Fetching..." : "Fetch profile"}
            </button>
          </div>
          <p className="text-xs text-muted-light mt-2">
            Public profiles only, no password needed. Private profile? Use the CSV upload below.
          </p>
        </div>
      )}

      {mode && mode !== "paste" && (
        <div className="bg-surface rounded-xl border border-border p-6 mb-6">
          <div className="flex flex-wrap items-center gap-3">
            {/* Category picker: Letterboxd exports can be films or TV; generic CSV can be anything */}
            {mode !== "goodreads" && (
              <div className="flex gap-2">
                {(mode === "letterboxd" ? (["film", "tv"] as Category[]) : (["book", "film", "tv"] as Category[])).map((c) => (
                  <button
                    key={c}
                    onClick={() => setCategory(c)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      category === c
                        ? "bg-accent text-background"
                        : "bg-surface-hover text-muted border border-border hover:text-foreground"
                    }`}
                  >
                    {c === "book" ? "Books" : c === "film" ? "Films" : "TV Shows"}
                  </button>
                ))}
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = "";
              }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={matching}
              className="px-4 py-2 bg-accent text-background rounded-lg text-sm font-medium hover:bg-accent-hover disabled:opacity-50 transition-colors"
            >
              {matching ? "Matching..." : "Choose CSV file"}
            </button>
            {matchProgress && <span className="text-xs text-muted">{matchProgress}</span>}
          </div>
        </div>
      )}

      {error && <p className="text-accent text-sm mb-4">{error}</p>}

      {result && (
        <div className="bg-surface rounded-xl border border-border p-6 mb-6">
          <p className="text-foreground text-sm">
            Imported <span className="font-mono font-semibold text-accent">{result.addedTrove}</span> into your Trove
            {result.addedUpNext > 0 && (
              <> and <span className="font-mono font-semibold text-accent">{result.addedUpNext}</span> into Up Next</>
            )}
            {result.skipped > 0 && <span className="text-muted"> ({result.skipped} skipped as duplicates)</span>}
          </p>
          <Link href="/trove" className="inline-block mt-3 text-sm text-accent hover:underline">
            See your Trove
          </Link>
        </div>
      )}

      {/* Preview */}
      {rows.length > 0 && (
        <>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-muted">
              <span className="font-mono text-accent">{selectedCount}</span> of {rows.length} selected
              {unmatchedCount > 0 && <span className="text-muted-light"> · {unmatchedCount} couldn&apos;t be matched</span>}
            </p>
            <button
              onClick={runImport}
              disabled={importing || selectedCount === 0}
              className="px-5 py-2 bg-accent text-background rounded-lg text-sm font-medium hover:bg-accent-hover disabled:opacity-50 transition-colors"
            >
              {importing ? "Importing..." : `Import ${selectedCount} items`}
            </button>
          </div>
          <div className="bg-surface rounded-xl border border-border divide-y divide-border max-h-[32rem] overflow-y-auto">
            {rows.map((r, i) => (
              <div key={i} className={`flex items-center gap-3 px-4 py-2.5 ${!r.match ? "opacity-50" : ""}`}>
                <input
                  type="checkbox"
                  checked={r.selected}
                  disabled={!r.match}
                  onChange={() =>
                    setRows((prev) => prev.map((row, j) => (j === i ? { ...row, selected: !row.selected } : row)))
                  }
                  className="accent-[#d9a648]"
                />
                {r.match?.coverUrl ? (
                  <img src={r.match.coverUrl} alt="" className="w-8 h-12 object-cover rounded" />
                ) : (
                  <div className="w-8 h-12 bg-surface-hover rounded" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-foreground truncate">
                    {r.match ? r.match.title : r.title}
                    {mode === "paste" && (
                      <span className="ml-2 text-xs font-mono uppercase text-muted-light">{r.rowCategory}</span>
                    )}
                    {r.toUpNext && <span className="ml-2 text-xs text-muted-light">→ Up Next</span>}
                  </div>
                  <div className="text-xs text-muted truncate">
                    {r.match ? [r.match.creator, r.match.year].filter(Boolean).join(" · ") : "No match found"}
                  </div>
                </div>
                {r.rating != null && !Number.isNaN(r.rating) && (
                  <span className="text-xs font-mono text-muted-light flex-shrink-0">{r.rating}★</span>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
