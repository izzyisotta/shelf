"use client";

import { useAuth } from "@/components/AuthContext";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";

interface MediaDetail {
  title: string;
  overview: string;
  year: string;
  poster: string;
  backdrop: string;
  genres: string[];
  rating?: number;
  runtime?: number;
  seasons?: number;
  director?: string;
  creator?: string;
  cast?: { name: string; character: string }[];
  author?: string;
  subjects?: string[];
}

interface SocialData {
  myItem: { id: string; rank: number } | null;
  onToConsume: boolean;
  friendsWithItem: {
    id: string;
    username: string;
    display_name: string;
    rank: number;
    item_id: string;
  }[];
  conversations: {
    friend: { id: string; username: string; display_name: string };
    item_id: string;
    last_message: string;
    last_message_at: string;
  }[];
}

interface Friend {
  id: string;
  username: string;
  display_name: string;
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

export default function MediaPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();

  const category = params.category as string;
  const externalIdParts = params.externalId as string[];
  // Books have external_id with leading slash (e.g. /works/OL123W) stored in DB
  const externalIdStr = category === "book"
    ? "/" + externalIdParts.join("/")
    : externalIdParts.join("/");

  const [detail, setDetail] = useState<MediaDetail | null>(null);
  const [social, setSocial] = useState<SocialData | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFullOverview, setShowFullOverview] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addingToConsume, setAddingToConsume] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Recommend state
  const [showRecommendModal, setShowRecommendModal] = useState(false);
  const [recommendFriends, setRecommendFriends] = useState<Friend[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);

  const categoryLabel =
    category === "book" ? "Book" : category === "film" ? "Film" : "TV Show";

  const loadData = useCallback(async () => {
    setLoadingData(true);
    try {
      const res = await fetch(
        `/api/media/${category}/${externalIdStr}`
      );
      if (!res.ok) {
        setError("Could not load media details");
        setLoadingData(false);
        return;
      }
      const data = await res.json();
      setDetail(data.detail);
      setSocial(data.social);
    } catch {
      setError("Failed to fetch media details");
    }
    setLoadingData(false);
  }, [category, externalIdStr]);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
    if (user) loadData();
  }, [user, loading, router, loadData]);

  async function addToConsumed() {
    if (!detail || adding) return;
    setAdding(true);
    try {
      const res = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          title: detail.title,
          creator:
            detail.director || detail.creator || detail.author || "",
          year: detail.year,
          coverUrl: detail.poster,
          externalId: externalIdStr,
        }),
      });
      if (res.ok) {
        showToast("Added to your Trove");
        loadData();
      } else {
        const data = await res.json();
        if (data.error?.includes("duplicate") || res.status === 409) {
          showToast("Already in your Trove");
        } else {
          showToast("Failed to add");
        }
      }
    } catch {
      showToast("Failed to add");
    }
    setAdding(false);
  }

  async function addToConsume() {
    if (!detail || addingToConsume) return;
    setAddingToConsume(true);
    try {
      const res = await fetch("/api/recommended", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          title: detail.title,
          creator:
            detail.director || detail.creator || detail.author || "",
          source: "Added by you",
        }),
      });
      if (res.ok) {
        showToast("Added to Up Next");
        loadData();
      } else if (res.status === 409) {
        showToast("Already on your list");
      } else {
        showToast("Failed to add");
      }
    } catch {
      showToast("Failed to add");
    }
    setAddingToConsume(false);
  }

  async function openRecommendModal() {
    setShowRecommendModal(true);
    setLoadingFriends(true);
    const res = await fetch("/api/friends/list");
    const data = await res.json();
    setRecommendFriends(data.friends || []);
    setLoadingFriends(false);
  }

  async function sendRecommend(friendId: string, friendName: string) {
    if (!detail) return;
    try {
      const res = await fetch("/api/recommended/friend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toUserId: friendId,
          category,
          title: detail.title,
          creator:
            detail.director || detail.creator || detail.author || "",
          coverUrl: detail.poster,
        }),
      });
      if (res.ok) {
        showToast(`Sent to ${friendName}`);
      } else if (res.status === 409) {
        showToast(`Already sent to ${friendName}`);
      } else {
        showToast("Failed to send");
      }
    } catch {
      showToast("Failed to send");
    }
    setShowRecommendModal(false);
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  if (loading || !user) return null;

  if (loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted">
        Loading...
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-8">
        <button
          onClick={() => router.back()}
          className="text-sm text-muted hover:text-foreground mb-6 flex items-center gap-1"
        >
          <span>&larr;</span> Back
        </button>
        <div className="text-center py-16 text-muted">
          {error || "Media not found"}
        </div>
      </div>
    );
  }

  const overviewLong = detail.overview.length > 300;
  const displayOverview =
    overviewLong && !showFullOverview
      ? detail.overview.slice(0, 300) + "..."
      : detail.overview;

  const creatorLine =
    detail.director || detail.creator || detail.author || "";

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <button
        onClick={() => router.back()}
        className="text-sm text-muted hover:text-foreground mb-6 flex items-center gap-1"
      >
        <span>&larr;</span> Back
      </button>

      {/* Hero section */}
      <div className="relative">
        {detail.backdrop && (
          <div className="absolute inset-0 -mx-6 -mt-8 h-64 overflow-hidden rounded-xl opacity-20">
            <img
              src={detail.backdrop}
              alt=""
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background" />
          </div>
        )}

        <div className="relative flex gap-5 mb-6">
          {detail.poster ? (
            <img
              src={detail.poster}
              alt={detail.title}
              className="w-32 h-48 object-cover rounded-lg shadow-lg flex-shrink-0"
            />
          ) : (
            <div className="w-32 h-48 bg-surface-hover rounded-lg flex items-center justify-center text-muted flex-shrink-0">
              {categoryLabel}
            </div>
          )}

          <div className="flex-1 min-w-0 pt-1">
            <h1 className="font-serif text-xl text-foreground leading-tight">
              {detail.title}
            </h1>
            {creatorLine && (
              <p className="text-sm text-muted mt-1">{creatorLine}</p>
            )}
            {detail.year && (
              <p className="text-sm text-muted-light">{detail.year}</p>
            )}

            {/* Info line */}
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-light">
              {detail.rating != null && detail.rating > 0 && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent-muted text-accent font-medium">
                  ★ {detail.rating.toFixed(1)}
                </span>
              )}
              {detail.runtime != null && detail.runtime > 0 && (
                <span>{detail.runtime} min</span>
              )}
              {detail.seasons != null && detail.seasons > 0 && (
                <span>
                  {detail.seasons} season
                  {detail.seasons !== 1 ? "s" : ""}
                </span>
              )}
            </div>

            {/* Genre pills */}
            {detail.genres.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {detail.genres.map((g) => (
                  <span
                    key={g}
                    className="text-xs px-2 py-0.5 rounded-full bg-accent-muted text-accent"
                  >
                    {g}
                  </span>
                ))}
              </div>
            )}

          </div>
        </div>

        {/* Overview */}
        {detail.overview && (
          <div className="mb-6">
            <p className="text-sm text-muted leading-relaxed">
              {displayOverview}
            </p>
            {overviewLong && (
              <button
                onClick={() => setShowFullOverview(!showFullOverview)}
                className="text-xs text-accent hover:text-accent-hover mt-1"
              >
                {showFullOverview ? "Show less" : "Show more"}
              </button>
            )}
          </div>
        )}

        {/* Cast for films/TV */}
        {detail.cast && detail.cast.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-foreground mb-2">
              Cast
            </h3>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {detail.cast.map((c, i) => (
                <span key={i} className="text-xs text-muted">
                  <span className="text-foreground">{c.name}</span>
                  {c.character && (
                    <span className="text-muted-light">
                      {" "}
                      as {c.character}
                    </span>
                  )}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Your Status section */}
      <div className="bg-surface rounded-xl border border-border p-5 mb-6">
        <h3 className="text-sm font-medium text-foreground mb-3">
          Your Status
        </h3>

        {social?.myItem ? (
          <div className="mb-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs px-3 py-1.5 rounded-sm bg-accent text-background font-medium">
                In your Trove, ranked #{social.myItem.rank}
              </span>
            </div>
            <button
              onClick={() => router.push(`/item/${social.myItem!.id}`)}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-surface-hover text-muted hover:bg-accent hover:text-background border border-border hover:border-accent transition-all"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              Chat about it
            </button>
          </div>
        ) : social?.onToConsume ? (
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs px-3 py-1.5 rounded-sm bg-surface-hover text-muted border border-border font-medium">
              On your Up Next list
            </span>
          </div>
        ) : (
          <div className="flex gap-2 mb-3">
            <button
              onClick={addToConsumed}
              disabled={adding}
              className="px-4 py-2 bg-accent text-background rounded-lg text-sm font-medium hover:bg-accent-hover disabled:opacity-50 transition-colors"
            >
              {adding ? "Adding..." : "Add to Trove"}
            </button>
            <button
              onClick={addToConsume}
              disabled={addingToConsume}
              className="px-4 py-2 bg-surface-hover text-muted rounded-lg text-sm border border-border hover:text-foreground disabled:opacity-50 transition-colors"
            >
              {addingToConsume ? "Adding..." : "Add to Up Next"}
            </button>
          </div>
        )}

        <button
          onClick={openRecommendModal}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-accent-muted text-accent hover:bg-accent hover:text-background transition-all"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 5l0-3" />
            <path d="M5 12l-3 0" />
            <path d="M19 12l3 0" />
            <path d="M7.05 7.05l-2.12-2.12" />
            <path d="M16.95 7.05l2.12-2.12" />
            <path d="M12 9a4 4 0 0 1 4 4c0 2-2 4-4 6-2-2-4-4-4-6a4 4 0 0 1 4-4z" />
          </svg>
          Recommend to a friend
        </button>
      </div>

      {/* Friends who have this */}
      {social &&
        social.friendsWithItem.length > 0 && (
          <div className="bg-surface rounded-xl border border-border p-5 mb-6">
            <h3 className="text-sm font-medium text-foreground mb-3">
              Friends who have this
            </h3>
            <div className="space-y-2">
              {social.friendsWithItem.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-accent-muted flex items-center justify-center flex-shrink-0">
                      <span className="text-accent text-sm font-bold">
                        {(
                          f.display_name || f.username
                        )[0].toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-foreground">
                        {f.display_name || f.username}
                      </span>
                      <span className="text-xs text-muted-light ml-2">
                        Ranked #{f.rank}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      router.push(
                        `/item/${f.item_id}?friend=${f.id}`
                      )
                    }
                    className="text-xs px-2.5 py-1.5 rounded-lg bg-surface-hover text-muted hover:bg-accent hover:text-background border border-border hover:border-accent transition-all"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="inline"
                    >
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

      {/* Conversations */}
      {social &&
        social.conversations.length > 0 && (
          <div className="bg-surface rounded-xl border border-border p-5 mb-6">
            <h3 className="text-sm font-medium text-foreground mb-3">
              Conversations
            </h3>
            <div className="space-y-2">
              {social.conversations.map((c) => (
                <button
                  key={c.friend.id}
                  onClick={() =>
                    router.push(
                      `/item/${c.item_id}?friend=${c.friend.id}`
                    )
                  }
                  className="w-full text-left flex items-center gap-3 p-3 rounded-lg hover:bg-surface-hover transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-accent-muted flex items-center justify-center flex-shrink-0">
                    <span className="text-accent text-sm font-bold">
                      {(
                        c.friend.display_name || c.friend.username
                      )[0].toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">
                        {c.friend.display_name || c.friend.username}
                      </span>
                      <span className="text-xs text-muted-light">
                        {timeAgo(c.last_message_at)}
                      </span>
                    </div>
                    <p className="text-xs text-muted truncate">
                      {c.last_message}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

      {/* Recommend friend picker modal */}
      {showRecommendModal && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          onClick={() => setShowRecommendModal(false)}
        >
          <div
            className="bg-surface rounded-xl border border-border max-w-sm w-full max-h-[60vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5">
              <h3 className="font-semibold text-foreground mb-4">
                Send to a friend
              </h3>
              {loadingFriends ? (
                <p className="text-sm text-muted py-4 text-center">
                  Loading friends...
                </p>
              ) : recommendFriends.length === 0 ? (
                <p className="text-sm text-muted py-4 text-center">
                  No friends yet. Add some first!
                </p>
              ) : (
                <div className="space-y-1">
                  {recommendFriends.map((f) => (
                    <button
                      key={f.id}
                      onClick={() =>
                        sendRecommend(
                          f.id,
                          f.display_name || f.username
                        )
                      }
                      className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-surface-hover transition-colors flex items-center gap-3"
                    >
                      <div className="w-8 h-8 rounded-full bg-accent-muted flex items-center justify-center flex-shrink-0">
                        <span className="text-accent text-sm font-bold">
                          {(
                            f.display_name || f.username
                          )
                            .charAt(0)
                            .toUpperCase()}
                        </span>
                      </div>
                      <span className="text-sm font-medium text-foreground">
                        {f.display_name || f.username}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              <button
                onClick={() => setShowRecommendModal(false)}
                className="mt-4 w-full py-2 text-sm text-muted hover:text-foreground transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-surface border border-accent/40 text-foreground text-sm px-4 py-2.5 rounded-xl shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
