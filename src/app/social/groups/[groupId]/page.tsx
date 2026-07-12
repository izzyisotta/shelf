"use client";

import { useAuth } from "@/components/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback, use } from "react";
import Link from "next/link";
import { useUserLibrary } from "@/hooks/useUserLibrary";

interface Member {
  id: string;
  username: string;
  display_name: string;
}

interface GroupMessage {
  id: string;
  body: string;
  created_at: string;
  author: { username: string; display_name: string };
}

interface GroupPickItem {
  title: string;
  creator: string;
  category: string;
  reason: string;
  externalId?: string;
  coverUrl?: string;
}

interface GroupPick {
  constraints_text: string;
  recommendation: { group_vibe?: string; picks?: GroupPickItem[] };
  created_at: string;
}

export default function GroupPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = use(params);
  const { user, loading } = useAuth();
  const router = useRouter();
  const library = useUserLibrary();

  const [groupName, setGroupName] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [latestPick, setLatestPick] = useState<GroupPick | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [constraints, setConstraints] = useState("");
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/groups/${groupId}`);
    if (!res.ok) {
      setNotFound(true);
      return;
    }
    const data = await res.json();
    setGroupName(data.group.name);
    setMembers(data.members || []);
    setMessages(data.messages || []);
    setLatestPick(data.latestPick);
  }, [groupId]);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
    if (user) load();
  }, [user, loading, router, load]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function send() {
    if (!newMessage.trim()) return;
    setSending(true);
    const res = await fetch(`/api/groups/${groupId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: newMessage }),
    });
    setSending(false);
    if (res.ok) {
      setNewMessage("");
      await load();
    }
  }

  async function generatePick() {
    setPicking(true);
    setError("");
    const res = await fetch(`/api/groups/${groupId}/pick`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ constraints }),
    });
    const data = await res.json();
    setPicking(false);
    if (!res.ok) {
      setError(data.error || "Pick failed");
      return;
    }
    setLatestPick(data.pick);
    setConstraints("");
  }

  async function addPickToUpNext(pick: GroupPickItem) {
    const result = await library.addToUpNext({
      category: pick.category,
      title: pick.title,
      creator: pick.creator,
      source: `Group pick - ${groupName}`,
    });
    if (result.ok) showToast(`Added "${pick.title}" to Up Next`);
    else if (result.alreadyExists) showToast("Already saved");
    else showToast(result.error || "Failed to add");
  }

  if (loading || !user) return null;
  if (notFound) {
    return (
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 md:py-8 text-center">
        <p className="text-muted mb-2">This group doesn&apos;t exist (or isn&apos;t switched on yet).</p>
        <Link href="/social/groups" className="text-sm text-accent hover:underline">
          Back to groups
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 md:py-8">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-surface border border-border rounded-lg px-4 py-3 shadow-lg text-sm text-foreground">
          {toast}
        </div>
      )}

      <Link href="/social/groups" className="inline-block text-sm text-muted hover:text-foreground mb-4 transition-colors">
        &larr; Groups
      </Link>

      <div className="bg-surface rounded-xl border border-border p-6 mb-6">
        <h1 className="font-serif text-2xl text-foreground mb-1">{groupName}</h1>
        <p className="text-xs font-mono text-muted-light">
          {members.map((m) => "@" + m.username).join(" · ")}
        </p>
      </div>

      {/* Group AI pick */}
      <div className="bg-surface rounded-xl border border-border p-6 mb-6">
        <h2 className="text-sm font-medium uppercase tracking-widest text-muted mb-3">
          Pick for the group
        </h2>
        <div className="flex flex-wrap gap-2 mb-4">
          <input
            type="text"
            value={constraints}
            onChange={(e) => setConstraints(e.target.value)}
            placeholder={'Optional constraints - "something short and funny", "film night", "under 300 pages"'}
            className="flex-1 min-w-48 px-4 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-light focus:ring-2 focus:ring-accent focus:border-transparent"
          />
          <button
            onClick={generatePick}
            disabled={picking}
            className="px-4 py-2 bg-accent text-background rounded-lg text-sm font-medium hover:bg-accent-hover disabled:opacity-50 transition-colors"
          >
            {picking ? "Reading everyone's taste..." : latestPick ? "Pick again" : "Pick for us"}
          </button>
        </div>
        {error && <p className="text-accent text-sm mb-3">{error}</p>}

        {latestPick?.recommendation && (
          <div>
            {latestPick.recommendation.group_vibe && (
              <p className="text-sm text-muted italic mb-3">{latestPick.recommendation.group_vibe}</p>
            )}
            {latestPick.constraints_text && (
              <p className="text-xs text-muted-light mb-3">Constraints: {latestPick.constraints_text}</p>
            )}
            <div className="space-y-2">
              {(latestPick.recommendation.picks || []).map((p, i) => (
                <div
                  key={i}
                  onClick={() => {
                    if (p.externalId) router.push(`/media/${p.category}/${p.externalId}`);
                  }}
                  className={`group flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-surface-hover transition-colors ${
                    p.externalId ? "cursor-pointer" : ""
                  }`}
                >
                  {p.coverUrl ? (
                    <img src={p.coverUrl} alt="" className="w-8 h-12 object-cover rounded-sm border border-border flex-shrink-0" />
                  ) : (
                    <div className="w-8 h-12 bg-surface-hover rounded-sm flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-foreground">
                      {p.title}
                      <span className="ml-2 text-xs font-mono uppercase text-muted-light">{p.category}</span>
                    </div>
                    <p className="text-xs text-muted-light mt-0.5">{p.reason}</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); addPickToUpNext(p); }}
                    className="flex-shrink-0 px-3 py-1.5 text-xs text-accent hover:bg-accent hover:text-background rounded-lg transition-colors border border-accent/30 max-md:opacity-100 opacity-0 group-hover:opacity-100"
                  >
                    + Up Next
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Chat */}
      <div className="bg-surface rounded-xl border border-border p-6">
        <h2 className="text-sm font-medium uppercase tracking-widest text-muted mb-4">Chat</h2>
        <div className="space-y-3 mb-4 max-h-96 overflow-y-auto">
          {messages.length === 0 && (
            <p className="text-xs text-muted-light">Nothing yet. Say something.</p>
          )}
          {messages.map((m) => (
            <div key={m.id}>
              <span className="text-xs font-mono text-accent">@{m.author.username}</span>
              <p className="text-sm text-foreground mt-0.5">{m.body}</p>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") send(); }}
            placeholder="Message the group"
            className="flex-1 px-4 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-light focus:ring-2 focus:ring-accent focus:border-transparent"
          />
          <button
            onClick={send}
            disabled={sending || !newMessage.trim()}
            className="px-4 py-2 bg-accent text-background rounded-lg text-sm font-medium hover:bg-accent-hover disabled:opacity-50 transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
