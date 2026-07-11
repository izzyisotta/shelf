"use client";

import { useState, useEffect, useCallback } from "react";

interface TroveItem {
  id: string;
  title: string;
  category: string;
  creator: string;
  year: string;
  cover_url: string;
  external_id: string;
  rank: number;
}

interface UpNextItem {
  id: string;
  title: string;
  category: string;
  creator: string;
}

export function useUserLibrary() {
  const [troveItems, setTroveItems] = useState<TroveItem[]>([]);
  const [upNextItems, setUpNextItems] = useState<UpNextItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [troveRes, upNextRes] = await Promise.all([
      fetch("/api/items"),
      fetch("/api/recommended"),
    ]);
    const [troveData, upNextData] = await Promise.all([
      troveRes.json(),
      upNextRes.json(),
    ]);
    setTroveItems(troveData.items || []);
    setUpNextItems(upNextData.items || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const isInTrove = useCallback(
    (title: string, category: string) =>
      troveItems.some(
        (i) => i.title.toLowerCase() === title.toLowerCase() && i.category === category
      ),
    [troveItems]
  );

  const isInUpNext = useCallback(
    (title: string, category: string) =>
      upNextItems.some(
        (i) => i.title.toLowerCase() === title.toLowerCase() && i.category === category
      ),
    [upNextItems]
  );

  const statusLabel = useCallback(
    (title: string, category: string): "In Trove" | "In Up Next" | null => {
      if (isInTrove(title, category)) return "In Trove";
      if (isInUpNext(title, category)) return "In Up Next";
      return null;
    },
    [isInTrove, isInUpNext]
  );

  const addToTrove = useCallback(
    async (item: { category: string; title: string; creator: string; year?: string; coverUrl?: string; externalId?: string }) => {
      const res = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: item.category,
          title: item.title,
          creator: item.creator,
          year: item.year || "",
          coverUrl: item.coverUrl || "",
          externalId: item.externalId || "",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setTroveItems((prev) => [...prev, data.item]);
        // Server clears the item from Up Next on arrival; mirror that locally
        setUpNextItems((prev) =>
          prev.filter(
            (i) =>
              !(
                i.title.toLowerCase() === item.title.toLowerCase() &&
                i.category === item.category
              )
          )
        );
        return { ok: true };
      }
      const data = await res.json();
      if (res.status === 409 || data.error?.includes("duplicate")) {
        return { ok: false, alreadyExists: true };
      }
      return { ok: false, error: data.error };
    },
    []
  );

  const addToUpNext = useCallback(
    async (item: { category: string; title: string; creator: string; source?: string }) => {
      const res = await fetch("/api/recommended", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: item.category,
          title: item.title,
          creator: item.creator,
          source: item.source || "Added by you",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setUpNextItems((prev) => [...prev, data.item]);
        return { ok: true };
      }
      const data = await res.json();
      if (res.status === 409) {
        return { ok: false, alreadyExists: true };
      }
      return { ok: false, error: data.error };
    },
    []
  );

  return { isInTrove, isInUpNext, statusLabel, addToTrove, addToUpNext, loading, refresh: load };
}
