"use client";

import { useAuth } from "@/components/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import MediaSearch from "@/components/MediaSearch";
import ItemGrid from "@/components/ItemGrid";
import { Item } from "@/types/item";

type Category = "book" | "film" | "tv";

export default function ConsumedPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [activeTab, setActiveTab] = useState<Category>("book");
  const [addMode, setAddMode] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    const res = await fetch("/api/items");
    const data = await res.json();
    setItems(data.items || []);
  }, []);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
    if (user) loadItems();
  }, [user, loading, router, loadItems]);

  async function addItem(result: { title: string; creator: string; year: string; coverUrl: string; externalId: string }) {
    const res = await fetch("/api/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: activeTab, ...result }),
    });
    if (res.ok) {
      await loadItems();
    }
  }

  async function deleteItem(id: string) {
    await fetch("/api/items", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await loadItems();
  }

  async function reorderItems(updates: { id: string; rank: number }[]) {
    setItems((prev) =>
      prev.map((item) => {
        const update = updates.find((u) => u.id === item.id);
        return update ? { ...item, rank: update.rank } : item;
      })
    );
    await fetch("/api/items", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: updates }),
    });
  }

  if (loading || !user) return null;

  const tabs: { key: Category; label: string }[] = [
    { key: "book", label: "Books" },
    { key: "film", label: "Films" },
    { key: "tv", label: "TV Shows" },
  ];

  const counts = {
    book: items.filter((i) => i.category === "book").length,
    film: items.filter((i) => i.category === "film").length,
    tv: items.filter((i) => i.category === "tv").length,
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Profile header */}
      <div className="bg-surface rounded-xl border border-border p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-mono font-semibold text-foreground">
              @{user.username}
            </h1>
          </div>
          <div className="flex gap-6 text-center">
            {tabs.map((t) => (
              <div key={t.key}>
                <div className="text-2xl font-mono font-semibold text-accent">{counts[t.key]}</div>
                <div className="text-xs text-muted">{t.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-6">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => { setActiveTab(t.key); setAddMode(false); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === t.key
                ? "bg-accent text-background"
                : "bg-surface text-muted hover:text-foreground border border-border"
            }`}
          >
            {t.label}
          </button>
        ))}

        <div className="flex-1" />

        <button
          onClick={() => router.push("/trove/import")}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-surface text-muted hover:text-foreground border border-border transition-colors"
        >
          Import
        </button>

        <button
          onClick={() => setAddMode(!addMode)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            addMode
              ? "bg-surface text-muted border border-border"
              : "bg-accent-muted text-accent hover:bg-accent hover:text-background"
          }`}
        >
          {addMode ? "Done" : "+ Add"}
        </button>
      </div>

      {/* Add item */}
      {addMode && (
        <div className="bg-surface rounded-xl border border-border p-4 mb-6">
          <MediaSearch category={activeTab} onSelect={addItem} />
          <p className="text-xs text-muted-light mt-2">
            Search and select to add to your Trove
          </p>
        </div>
      )}

      {/* Grid */}
      <ItemGrid
        items={items}
        category={activeTab}
        editable
        onDelete={deleteItem}
        onReorder={reorderItems}
      />

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-surface border border-accent/40 text-foreground text-sm px-4 py-2.5 rounded-xl shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
