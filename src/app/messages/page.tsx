"use client";

import { useAuth } from "@/components/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";

interface Conversation {
  item: { id: string; title: string; category: string; cover_url: string };
  otherPerson: { id: string; display_name: string };
  lastMessage: { body: string; created_at: string; author: { display_name: string } };
  messageCount: number;
}

export default function ConversationsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const loadData = useCallback(async () => {
    setLoadingData(true);
    const res = await fetch("/api/conversations");
    const data = await res.json();
    setConversations(data.conversations || []);
    setLoadingData(false);
  }, []);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
    if (user) loadData();
  }, [user, loading, router, loadData]);

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  function categoryBadge(category: string) {
    return category === "book" ? "BK" : category === "film" ? "FM" : "TV";
  }

  if (loading || !user) return null;

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-8">
      <div className="bg-surface rounded-xl border border-border p-6 mb-6">
        <h1 className="font-serif text-2xl text-foreground">Messages</h1>
        <p className="text-sm text-muted mt-1">Your conversations about books, films, and shows</p>
      </div>

      {loadingData ? (
        <div className="text-center py-16 text-muted">Loading...</div>
      ) : conversations.length === 0 ? (
        <div className="text-center py-16 text-muted">
          <p className="text-lg mb-2">No conversations yet</p>
          <p className="text-sm text-muted-light">Click any item to start one.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {conversations.map((conv, i) => (
            <div
              key={`${conv.item.id}-${conv.otherPerson.id}`}
              onClick={() => router.push(`/item/${conv.item.id}?friend=${conv.otherPerson.id}`)}
              className="bg-surface rounded-xl border border-border p-4 hover:border-accent/30 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-4">
                {conv.item.cover_url ? (
                  <img
                    src={conv.item.cover_url}
                    alt=""
                    className="w-10 h-14 object-cover rounded flex-shrink-0"
                  />
                ) : (
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-accent-muted flex items-center justify-center">
                    <span className="text-accent text-xs font-bold uppercase">
                      {categoryBadge(conv.item.category)}
                    </span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{conv.item.title}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-accent-muted text-accent font-medium uppercase">
                      {categoryBadge(conv.item.category)}
                    </span>
                    <span className="text-xs text-muted-light">with {conv.otherPerson.display_name}</span>
                  </div>
                  <p className="text-sm text-muted mt-0.5 truncate">
                    <span className="font-medium">{conv.lastMessage.author.display_name}:</span>{" "}
                    {conv.lastMessage.body}
                  </p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <div className="text-xs text-muted-light">{timeAgo(conv.lastMessage.created_at)}</div>
                  <div className="text-xs text-muted mt-0.5">{conv.messageCount} msg{conv.messageCount !== 1 ? "s" : ""}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
