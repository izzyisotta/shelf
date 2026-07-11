# Hooks

## useUserLibrary

**File:** `useUserLibrary.ts`

A client-side hook that provides access to the current user's library state across both their Trove (consumed items) and their Up Next list (to-consume items). On mount, it fetches both lists in parallel from `/api/items` and `/api/recommended`, then exposes utilities for checking and modifying library membership.

The hook is designed to prevent duplicate additions. Components that display media from external sources (search results, friend Troves, AI recommendations) use `statusLabel()` to check whether an item is already in the user's Trove or Up Next list before showing add buttons. The label returns "In Trove", "In Up Next", or null, and matching is case-insensitive on title within the same category.

The `addToTrove()` and `addToUpNext()` methods handle the POST requests and optimistically update local state on success. Both return a result object with `ok`, and optionally `alreadyExists` (on 409 conflict) or `error` (on other failures), so callers can show appropriate feedback without needing to parse HTTP responses.

**Used in:** ItemGrid (to show library status badges on cards and power add-to-Up-Next buttons), Explore discover page (to check status of AI recommendations), and media detail pages (to show whether the user already has a title).

**Returns:**
- `isInTrove(title, category)` - Returns true if the item is in the user's Trove.
- `isInUpNext(title, category)` - Returns true if the item is in the user's Up Next list.
- `statusLabel(title, category)` - Returns "In Trove", "In Up Next", or null.
- `addToTrove(item)` - Adds an item to the Trove via POST. Accepts `{ category, title, creator, year?, coverUrl?, externalId? }`.
- `addToUpNext(item)` - Adds an item to Up Next via POST. Accepts `{ category, title, creator, source? }`.
- `loading` - Boolean indicating whether the initial fetch is still in progress.
- `refresh()` - Re-fetches both lists from the server.
