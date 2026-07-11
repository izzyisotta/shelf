// Tiers are derived from rank position with fixed bucket sizes, so a tier
// means the same thing on everyone's Trove (see Features & Build Plan, B4).
// Ranks 1-12: five-star tier. Ranks 13-40: four-star tier. 41+: library.

export type Tier = "five" | "four" | "library";

export const TIER_BOUNDS = { five: 12, four: 40 };

export function tierOf(rank: number): Tier {
  if (rank <= TIER_BOUNDS.five) return "five";
  if (rank <= TIER_BOUNDS.four) return "four";
  return "library";
}

export const TIER_LABELS: Record<Tier, string> = {
  five: "★★★★★",
  four: "★★★★",
  library: "Library",
};

export const TIER_DESCRIPTIONS: Record<Tier, string> = {
  five: "The ones that define your taste",
  four: "Loved it",
  library: "Everything else you've consumed",
};

// Where a new item lands when assigned a tier on arrival: the end of that
// tier (or the end of the list if the list is still shorter than the tier)
export function insertionRank(tier: Tier, currentCount: number): number {
  if (tier === "five") return Math.min(TIER_BOUNDS.five, currentCount + 1);
  if (tier === "four") return Math.min(TIER_BOUNDS.four, currentCount + 1);
  return currentCount + 1;
}
