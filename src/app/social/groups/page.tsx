"use client";

import { useAuth } from "@/components/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface Group {
  id: string;
  name: string;
  memberCount: number;
  created_at: string;
}

interface Friend {
  id: string;
  username: string;
  display_name: string;
}

export default function GroupsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [needsMigration, setNeedsMigration] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/groups");
    const data = await res.json();
    setGroups(data.groups || []);
    setNeedsMigration(!!data.needsMigration);
  }, []);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
    if (user) load();
  }, [user, loading, router, load]);

  async function openCreate() {
    setCreating(true);
    const res = await fetch("/api/friends/list");
    const data = await res.json();
    setFriends(data.friends || []);
  }

  async function createGroup() {
    if (!name.trim()) return;
    setSaving(true);
    setError("");
    const res = await fetch("/api/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, memberIds: [...selected] }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error || "Couldn't create the group");
      return;
    }
    router.push(`/social/groups/${data.group.id}`);
  }

  if (loading || !user) return null;

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-serif text-2xl text-foreground">Groups</h1>
        {!needsMigration && (
          <button
            onClick={openCreate}
            className="px-4 py-2 bg-accent text-background rounded-lg text-sm font-medium hover:bg-accent-hover transition-colors"
          >
            New group
          </button>
        )}
      </div>

      {needsMigration ? (
        <div className="bg-surface rounded-xl border border-border p-8 text-center">
          <p className="text-foreground text-sm mb-1">Groups are built but not switched on yet.</p>
          <p className="text-muted-light text-xs">The database migration hasn&apos;t run - it&apos;s one command away.</p>
        </div>
      ) : groups.length === 0 && !creating ? (
        <div className="bg-surface rounded-xl border border-border p-8 text-center">
          <p className="text-foreground text-sm mb-1">No groups yet.</p>
          <p className="text-muted-light text-xs mb-4">
            A book club or film night: everyone&apos;s taste, one AI pick nobody has consumed.
          </p>
          <button onClick={openCreate} className="text-sm text-accent hover:underline">
            Start one
          </button>
        </div>
      ) : (
        <div className="space-y-2 mb-6">
          {groups.map((g) => (
            <Link
              key={g.id}
              href={`/social/groups/${g.id}`}
              className="block bg-surface rounded-xl border border-border p-4 hover:border-accent/30 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="text-foreground font-medium">{g.name}</span>
                <span className="text-xs font-mono text-muted-light">
                  {g.memberCount} member{g.memberCount === 1 ? "" : "s"}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {creating && (
        <div className="bg-surface rounded-xl border border-border p-6">
          <h2 className="text-sm font-medium uppercase tracking-widest text-muted mb-4">New group</h2>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Group name - e.g. Book club, Film night"
            className="w-full px-4 py-2 mb-4 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-light focus:ring-2 focus:ring-accent focus:border-transparent"
          />
          <p className="text-xs text-muted mb-2">Add friends:</p>
          <div className="flex flex-wrap gap-2 mb-4">
            {friends.length === 0 && (
              <p className="text-xs text-muted-light">No friends yet - share your taste link first.</p>
            )}
            {friends.map((f) => {
              const on = selected.has(f.id);
              return (
                <button
                  key={f.id}
                  onClick={() =>
                    setSelected((prev) => {
                      const next = new Set(prev);
                      if (on) next.delete(f.id);
                      else next.add(f.id);
                      return next;
                    })
                  }
                  className={`px-3 py-1.5 rounded-sm text-xs font-medium border transition-colors ${
                    on
                      ? "border-accent text-accent bg-accent-muted"
                      : "border-border text-muted hover:text-foreground"
                  }`}
                >
                  {f.display_name || f.username}
                </button>
              );
            })}
          </div>
          {error && <p className="text-accent text-sm mb-3">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={createGroup}
              disabled={saving || !name.trim()}
              className="px-4 py-2 bg-accent text-background rounded-lg text-sm font-medium hover:bg-accent-hover disabled:opacity-50 transition-colors"
            >
              {saving ? "Creating..." : "Create group"}
            </button>
            <button
              onClick={() => setCreating(false)}
              className="px-4 py-2 text-sm text-muted hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
