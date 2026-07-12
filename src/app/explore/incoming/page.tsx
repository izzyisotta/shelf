"use client";

import { useAuth } from "@/components/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { useUserLibrary } from "@/hooks/useUserLibrary";

interface PendingRec {
  id: string;
  category: string;
  title: string;
  creator: string;
  source: string;
  status: string;
}

interface IncomingMessage {
  id: string;
  body: string;
  created_at: string;
  author: { id: string; username: string; display_name: string };
  item: { id: string; title: string; category: string; cover_url: string };
}

interface Nudge {
  title: string;
  creator: string;
  category: string;
  cover_url: string;
  external_id: string;
  reason: string;
  friends: { username: string; display_name: string }[];
}

export default function IncomingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [pendingRecs, setPendingRecs] = useState<PendingRec[]>([]);
  const [messages, setMessages] = useState<IncomingMessage[]>([]);
  const [nudges, setNudges] = useState<Nudge[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [savingNudge, setSavingNudge] = useState<string | null>(null);
  const library = useUserLibrary();

  const loadData = useCallback(async () => {
    setLoadingData(true);
    const [recsRes, messagesRes, nudgesRes] = await Promise.all([
      fetch("/api/recommended"),
      fetch("/api/messages/incoming"),
      fetch("/api/incoming/nudges"),
    ]);

    const [recsData, messagesData, nudgesData] = await Promise.all([
      recsRes.json(),
      messagesRes.json(),
      nudgesRes.json(),
    ]);

    // Filter to only pending friend recs
    const pending = (recsData.items || []).filter(
      (i: PendingRec) => i.source.startsWith("Recommended by") && i.status === "pending"
    );
    setPendingRecs(pending);
    setMessages(messagesData.messages || []);
    setNudges(nudgesData.nudges || []);
    setLoadingData(false);
  }, []);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
    if (user) loadData();
  }, [user, loading, router, loadData]);

  async function acceptRec(id: string) {
    await fetch("/api/recommended", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, table: "friend_recommendations", status: "accepted" }),
    });
    setPendingRecs((prev) => prev.filter((r) => r.id !== id));
  }

  async function declineRec(id: string) {
    await fetch("/api/recommended", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, table: "friend_recommendations", status: "declined" }),
    });
    setPendingRecs((prev) => prev.filter((r) => r.id !== id));
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function nudgeToTrove(nudge: Nudge) {
    const key = `${nudge.title}|${nudge.category}`;
    setSavingNudge(key + ":trove");
    const result = await library.addToTrove({
      category: nudge.category,
      title: nudge.title,
      creator: nudge.creator,
      coverUrl: nudge.cover_url,
      externalId: nudge.external_id,
    });
    if (result.ok) {
      showToast(`Added "${nudge.title}" to your Trove`);
    } else if (result.alreadyExists) {
      showToast("Already in your Trove");
    } else {
      showToast(result.error || "Failed to add");
    }
    setSavingNudge(null);
  }

  async function nudgeToUpNext(nudge: Nudge) {
    const key = `${nudge.title}|${nudge.category}`;
    setSavingNudge(key + ":upnext");
    const result = await library.addToUpNext({
      category: nudge.category,
      title: nudge.title,
      creator: nudge.creator,
      source: "From nudge",
    });
    if (result.ok) {
      showToast(`Added "${nudge.title}" to Up Next`);
    } else if (result.alreadyExists) {
      showToast("Already in Up Next");
    } else {
      showToast(result.error || "Failed to add");
    }
    setSavingNudge(null);
  }

  if (loading || !user) return null;

  const totalPending = pendingRecs.length;
  const isEmpty = pendingRecs.length === 0 && messages.length === 0 && nudges.length === 0;

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

      {/* Header */}
      <div className="bg-surface rounded-xl border border-border p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-2xl text-foreground">Incoming</h1>
            <p className="text-sm text-muted mt-1">Things that need your attention</p>
          </div>
          {totalPending > 0 && (
            <div className="text-center">
              <div className="text-2xl font-mono font-semibold text-accent">{totalPending}</div>
              <div className="text-xs text-muted">pending</div>
            </div>
          )}
        </div>
      </div>

      {loadingData ? (
        <div className="text-center py-16 text-muted">Loading...</div>
      ) : isEmpty ? (
        <div className="text-center py-16 text-muted">
          <p className="text-lg mb-2">All caught up!</p>
          <p className="text-sm text-muted-light">Nothing new right now.</p>
        </div>
      ) : (
        <>
          {/* Pending Friend Recs */}
          {pendingRecs.length > 0 && (
            <div className="mb-6">
              <h2 className="text-sm font-medium text-muted uppercase tracking-wide mb-3">
                Friend Recommendations
              </h2>
              <div className="bg-surface rounded-xl border border-accent/30 p-4 space-y-3">
                {pendingRecs.map((rec) => (
                  <div key={rec.id} className="flex items-center gap-4 py-2">
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-accent-muted flex items-center justify-center">
                      <span className="text-accent text-xs font-bold uppercase">
                        {categoryBadge(rec.category)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-foreground">{rec.title}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {rec.creator && <span className="text-sm text-muted">{rec.creator}</span>}
                        {rec.creator && <span className="text-muted-light">·</span>}
                        <span className="text-xs text-accent">{rec.source}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => acceptRec(rec.id)}
                        className="px-4 py-1.5 bg-accent text-background rounded-lg text-sm hover:bg-accent-hover"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => declineRec(rec.id)}
                        className="px-4 py-1.5 bg-surface-hover text-muted rounded-lg text-sm border border-border hover:text-foreground"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.length > 0 && (
            <div className="mb-6">
              <h2 className="text-sm font-medium text-muted uppercase tracking-wide mb-3">
                Messages
              </h2>
              <div className="space-y-2">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    onClick={() => router.push(`/item/${m.item.id}?friend=${m.author.id}`)}
                    className="bg-surface rounded-xl border border-border p-4 hover:border-accent/30 transition-colors cursor-pointer"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent-muted flex items-center justify-center">
                        <span className="text-accent text-xs font-bold">
                          {(m.author.display_name || m.author.username)[0].toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground text-sm">
                            {m.author.display_name || m.author.username}
                          </span>
                          <span className="text-muted-light text-xs">messaged you about</span>
                          <span className="text-accent text-sm font-medium">{m.item.title}</span>
                          <span className="text-muted-light text-xs">{timeAgo(m.created_at)}</span>
                        </div>
                        <p className="text-sm text-muted mt-1 truncate">{m.body}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Nudges */}
          {nudges.length > 0 && (
            <div className="mb-6">
              <h2 className="text-sm font-medium text-muted uppercase tracking-wide mb-3">
                Friends who share your taste also liked...
              </h2>
              <div className="space-y-2">
                {nudges.map((nudge, i) => {
                  const status = library.statusLabel(nudge.title, nudge.category);
                  const nudgeKey = `${nudge.title}|${nudge.category}`;
                  return (
                    <div
                      key={i}
                      className="group bg-surface rounded-xl border border-border p-4 hover:border-accent/30 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={nudge.external_id ? "cursor-pointer" : ""}
                          onClick={() => {
                            if (nudge.external_id) {
                              router.push(`/media/${nudge.category}/${nudge.external_id}`);
                            }
                          }}
                        >
                          {nudge.cover_url ? (
                            <img
                              src={nudge.cover_url}
                              alt=""
                              className="w-10 h-14 object-cover rounded flex-shrink-0"
                            />
                          ) : (
                            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-accent-muted flex items-center justify-center">
                              <span className="text-accent text-xs font-bold uppercase">
                                {categoryBadge(nudge.category)}
                              </span>
                            </div>
                          )}
                        </div>
                        <div
                          className={`flex-1 min-w-0 ${nudge.external_id ? "cursor-pointer" : ""}`}
                          onClick={() => {
                            if (nudge.external_id) {
                              router.push(`/media/${nudge.category}/${nudge.external_id}`);
                            }
                          }}
                        >
                          <div className="font-medium text-foreground">{nudge.title}</div>
                          <div className="flex items-center gap-2 mt-0.5">
                            {nudge.creator && (
                              <span className="text-sm text-muted">{nudge.creator}</span>
                            )}
                            {nudge.creator && <span className="text-muted-light">·</span>}
                            <span className="text-xs text-muted-light capitalize">{nudge.category}</span>
                          </div>
                          <p className="text-xs text-accent mt-1">{nudge.reason}</p>
                        </div>
                        <div className="flex-shrink-0 flex gap-1.5">
                          {status ? (
                            <span className="px-3 py-1.5 text-xs text-muted-light bg-surface-hover rounded-lg border border-border">
                              {status}
                            </span>
                          ) : (
                            <>
                              <button
                                onClick={() => nudgeToTrove(nudge)}
                                disabled={savingNudge === nudgeKey + ":trove"}
                                className="px-3 py-1.5 text-xs text-accent hover:bg-accent hover:text-background rounded-lg transition-colors border border-accent/30 max-md:opacity-100 opacity-0 group-hover:opacity-100"
                              >
                                + Trove
                              </button>
                              <button
                                onClick={() => nudgeToUpNext(nudge)}
                                disabled={savingNudge === nudgeKey + ":upnext"}
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
            </div>
          )}

          {/* Group Picks placeholder */}
          <div className="mb-6">
            <h2 className="text-sm font-medium text-muted uppercase tracking-wide mb-3">
              Group Picks
            </h2>
            <div className="bg-surface rounded-xl border border-border/50 p-6 text-center">
              <p className="text-muted text-sm">Group recommendations are coming soon.</p>
              <p className="text-muted-light text-xs mt-1">
                Create groups with friends to get collective picks.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
