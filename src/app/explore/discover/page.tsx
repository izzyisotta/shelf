"use client";

import { useAuth } from "@/components/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import MediaSearch from "@/components/MediaSearch";
import { useUserLibrary } from "@/hooks/useUserLibrary";

interface Pick {
  title: string;
  creator: string;
  category: string;
  reason: string;
}

interface PersonalRec {
  taste_profile: string;
  picks: Pick[];
}

interface ActivityItem {
  title: string;
  creator: string;
  category: string;
  cover_url: string;
  external_id: string;
  year: string;
  created_at: string;
  friend: { id: string; username: string; display_name: string };
}

export default function DiscoverPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [searchCategory, setSearchCategory] = useState<"book" | "film" | "tv">("book");
  const [toast, setToast] = useState<string | null>(null);
  const [personalRec, setPersonalRec] = useState<PersonalRec | null>(null);
  const [recTimestamp, setRecTimestamp] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [loadingRec, setLoadingRec] = useState(true);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [savingPick, setSavingPick] = useState<string | null>(null);
  const [savingActivity, setSavingActivity] = useState<string | null>(null);
  const library = useUserLibrary();

  const loadData = useCallback(async () => {
    const [recRes, activityRes] = await Promise.all([
      fetch("/api/recommend/personal"),
      fetch("/api/friends/activity"),
    ]);
    const [recData, activityData] = await Promise.all([
      recRes.json(),
      activityRes.json(),
    ]);

    if (recData.recommendation) {
      setPersonalRec(recData.recommendation);
      setRecTimestamp(recData.created_at);
    }
    setActivity(activityData.activity || []);
    setLoadingRec(false);
  }, []);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
    if (user) loadData();
  }, [user, loading, router, loadData]);

  async function handleSearchSelect(result: { title: string; creator: string; year: string; coverUrl: string; externalId: string }) {
    const res = await fetch("/api/recommended", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: searchCategory,
        title: result.title,
        creator: result.creator,
        source: "Added by you",
      }),
    });
    if (res.ok) {
      showToast(`Added "${result.title}" to Up Next`);
      library.refresh();
    } else {
      const data = await res.json();
      showToast(data.error || "Failed to add");
    }
  }

  async function generateRecs() {
    setGenerating(true);
    try {
      const res = await fetch("/api/recommend/personal", { method: "POST" });
      const data = await res.json();
      if (data.error) {
        showToast(data.error);
      } else {
        setPersonalRec(data.recommendation);
        setRecTimestamp(data.created_at);
      }
    } catch {
      showToast("Failed to generate recommendations");
    }
    setGenerating(false);
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function savePickToUpNext(pick: Pick) {
    const key = `${pick.title}|${pick.category}`;
    setSavingPick(key + ":upnext");
    const result = await library.addToUpNext({
      category: pick.category,
      title: pick.title,
      creator: pick.creator,
      source: "AI pick for you",
    });
    if (result.ok) {
      showToast(`Added "${pick.title}" to Up Next`);
    } else if (result.alreadyExists) {
      showToast("Already in Up Next");
    } else {
      showToast(result.error || "Failed to save");
    }
    setSavingPick(null);
  }

  async function savePickToTrove(pick: Pick) {
    const key = `${pick.title}|${pick.category}`;
    setSavingPick(key + ":trove");
    const result = await library.addToTrove({
      category: pick.category,
      title: pick.title,
      creator: pick.creator,
    });
    if (result.ok) {
      showToast(`Added "${pick.title}" to your Trove`);
    } else if (result.alreadyExists) {
      showToast("Already in your Trove");
    } else {
      showToast(result.error || "Failed to add");
    }
    setSavingPick(null);
  }

  async function saveActivityToTrove(item: ActivityItem) {
    const key = `${item.title}|${item.category}`;
    setSavingActivity(key + ":trove");
    const result = await library.addToTrove({
      category: item.category,
      title: item.title,
      creator: item.creator,
      year: item.year,
      coverUrl: item.cover_url,
      externalId: item.external_id,
    });
    if (result.ok) {
      showToast(`Added "${item.title}" to your Trove`);
    } else if (result.alreadyExists) {
      showToast("Already in your Trove");
    } else {
      showToast(result.error || "Failed to add");
    }
    setSavingActivity(null);
  }

  async function saveActivityToUpNext(item: ActivityItem) {
    const key = `${item.title}|${item.category}`;
    setSavingActivity(key + ":upnext");
    const result = await library.addToUpNext({
      category: item.category,
      title: item.title,
      creator: item.creator,
      source: `From ${item.friend.display_name || item.friend.username}'s activity`,
    });
    if (result.ok) {
      showToast(`Added "${item.title}" to Up Next`);
    } else if (result.alreadyExists) {
      showToast("Already in Up Next");
    } else {
      showToast(result.error || "Failed to add");
    }
    setSavingActivity(null);
  }

  if (loading || !user) return null;

  const categoryTabs: { key: "book" | "film" | "tv"; label: string }[] = [
    { key: "book", label: "Book" },
    { key: "film", label: "Film" },
    { key: "tv", label: "TV" },
  ];

  function categoryBadge(category: string) {
    return category === "book" ? "BK" : category === "film" ? "FM" : "TV";
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-8">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-surface border border-border rounded-lg px-4 py-3 shadow-lg text-sm text-foreground">
          {toast}
        </div>
      )}

      {/* Search Section */}
      <div className="bg-surface rounded-xl border border-border p-6 mb-6">
        <h2 className="text-lg font-bold text-foreground mb-3">Search</h2>
        <div className="flex gap-2 mb-3">
          {categoryTabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setSearchCategory(t.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                searchCategory === t.key
                  ? "bg-accent text-background"
                  : "bg-background text-muted border border-border hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <MediaSearch category={searchCategory} onSelect={handleSearchSelect} />
        <p className="text-xs text-muted-light mt-2">
          Search and select to add to Up Next
        </p>
      </div>

      {/* AI Picks for You */}
      <div className="bg-surface rounded-xl border border-border p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-foreground">AI Picks for You</h2>
            {recTimestamp && (
              <p className="text-xs text-muted-light mt-0.5">
                Generated {timeAgo(recTimestamp)}
              </p>
            )}
          </div>
          <button
            onClick={generateRecs}
            disabled={generating}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              generating
                ? "bg-surface-hover text-muted cursor-not-allowed"
                : "bg-accent-muted text-accent hover:bg-accent hover:text-background"
            }`}
          >
            {generating ? "Generating..." : personalRec ? "Refresh" : "Generate"}
          </button>
        </div>

        {loadingRec ? (
          <div className="text-center py-8 text-muted text-sm">Loading...</div>
        ) : personalRec ? (
          <>
            <p className="text-sm text-muted italic mb-4">{personalRec.taste_profile}</p>
            {(["book", "film", "tv"] as const)
              .map((cat) => ({ cat, picks: personalRec.picks.filter((p) => p.category === cat) }))
              .filter((g) => g.picks.length > 0)
              .map((group) => (
            <div key={group.cat} className="mb-5 last:mb-0">
              <h3 className="text-xs font-medium uppercase tracking-wide text-muted-light mb-1 px-3">
                {group.cat === "book" ? "Books" : group.cat === "film" ? "Films" : "TV Shows"}
              </h3>
            <div className="space-y-2">
              {group.picks.map((pick, i) => {
                const status = library.statusLabel(pick.title, pick.category);
                const pickKey = `${pick.title}|${pick.category}`;
                return (
                  <div
                    key={i}
                    className="group flex items-center gap-4 py-3 px-3 rounded-lg hover:bg-surface-hover transition-colors"
                  >
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-accent-muted flex items-center justify-center">
                      <span className="text-accent text-xs font-bold uppercase">
                        {categoryBadge(pick.category)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-foreground text-sm">{pick.title}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {pick.creator && <span className="text-xs text-muted">{pick.creator}</span>}
                        {pick.creator && <span className="text-muted-light">·</span>}
                        <span className="text-xs text-muted-light capitalize">{pick.category}</span>
                      </div>
                      <p className="text-xs text-muted-light mt-0.5">{pick.reason}</p>
                    </div>
                    <div className="flex-shrink-0 flex gap-1.5">
                      {status ? (
                        <span className="px-3 py-1.5 text-xs text-muted-light bg-surface-hover rounded-lg border border-border">
                          {status}
                        </span>
                      ) : (
                        <>
                          <button
                            onClick={() => savePickToTrove(pick)}
                            disabled={savingPick === pickKey + ":trove"}
                            className="px-3 py-1.5 text-xs text-accent hover:bg-accent hover:text-background rounded-lg transition-colors border border-accent/30 max-md:opacity-100 opacity-0 group-hover:opacity-100"
                          >
                            + Trove
                          </button>
                          <button
                            onClick={() => savePickToUpNext(pick)}
                            disabled={savingPick === pickKey + ":upnext"}
                            className="px-3 py-1.5 text-xs text-accent hover:bg-accent hover:text-background rounded-lg transition-colors border border-accent/30 max-md:opacity-100 opacity-0 group-hover:opacity-100"
                          >
                            + Up Next
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            </div>
              ))}
          </>
        ) : (
          <div className="text-center py-8 text-muted">
            <p className="text-sm mb-1">No recommendations yet</p>
            <p className="text-xs text-muted-light">
              Hit Generate to get personalised picks based in your Trove
            </p>
          </div>
        )}
      </div>

      {/* Friends' Activity */}
      <div className="mb-6">
        <h2 className="text-sm font-medium text-muted uppercase tracking-wide mb-3">
          Friends&apos; Activity
        </h2>
        {activity.length === 0 ? (
          <div className="bg-surface rounded-xl border border-border p-6 text-center">
            <p className="text-muted text-sm">No recent activity from friends.</p>
            <p className="text-muted-light text-xs mt-1">
              When friends add items to their shelves, you&apos;ll see it here.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {activity.map((item, i) => {
              const status = library.statusLabel(item.title, item.category);
              const actKey = `${item.title}|${item.category}`;
              return (
                <div
                  key={i}
                  className="group bg-surface rounded-xl border border-border p-4 hover:border-accent/30 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={item.external_id ? "cursor-pointer" : ""}
                      onClick={() => {
                        if (item.external_id) {
                          router.push(`/media/${item.category}/${item.external_id}`);
                        }
                      }}
                    >
                      {item.cover_url ? (
                        <img
                          src={item.cover_url}
                          alt=""
                          className="w-10 h-14 object-cover rounded flex-shrink-0"
                        />
                      ) : (
                        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-accent-muted flex items-center justify-center">
                          <span className="text-accent text-xs font-bold uppercase">
                            {categoryBadge(item.category)}
                          </span>
                        </div>
                      )}
                    </div>
                    <div
                      className={`flex-1 min-w-0 ${item.external_id ? "cursor-pointer" : ""}`}
                      onClick={() => {
                        if (item.external_id) {
                          router.push(`/media/${item.category}/${item.external_id}`);
                        }
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground text-sm">
                          {item.friend.display_name || item.friend.username}
                        </span>
                        <span className="text-muted-light text-xs">added</span>
                      </div>
                      <div className="font-medium text-foreground mt-0.5">{item.title}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {item.creator && (
                          <span className="text-xs text-muted">{item.creator}</span>
                        )}
                        {item.creator && <span className="text-muted-light">·</span>}
                        <span className="text-xs text-muted-light capitalize">{item.category}</span>
                        <span className="text-muted-light">·</span>
                        <span className="text-xs text-muted-light">{timeAgo(item.created_at)}</span>
                      </div>
                    </div>
                    <div className="flex-shrink-0 flex gap-1.5">
                      {status ? (
                        <span className="px-3 py-1.5 text-xs text-muted-light bg-surface-hover rounded-lg border border-border">
                          {status}
                        </span>
                      ) : (
                        <>
                          <button
                            onClick={() => saveActivityToTrove(item)}
                            disabled={savingActivity === actKey + ":trove"}
                            className="px-3 py-1.5 text-xs text-accent hover:bg-accent hover:text-background rounded-lg transition-colors border border-accent/30 max-md:opacity-100 opacity-0 group-hover:opacity-100"
                          >
                            + Trove
                          </button>
                          <button
                            onClick={() => saveActivityToUpNext(item)}
                            disabled={savingActivity === actKey + ":upnext"}
                            className="px-3 py-1.5 text-xs text-accent hover:bg-accent hover:text-background rounded-lg transition-colors border border-accent/30 max-md:opacity-100 opacity-0 group-hover:opacity-100"
                          >
                            + Up Next
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
