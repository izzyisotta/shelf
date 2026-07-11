# Types

## Item

**File:** `item.ts`

The shared `Item` interface represents a single entry in a user's Trove. It maps directly to a row in the `items` database table and is used throughout the frontend wherever Trove items are displayed or manipulated.

**Fields:**
- `id: string` - UUID primary key from the database.
- `category: string` - One of "book", "film", or "tv".
- `title: string` - The item's title.
- `creator: string` - Author, director, or show creator. May be empty.
- `year: string` - Release or publication year. Stored as a string; may be empty.
- `cover_url: string` - URL to a cover image from Open Library (books) or TMDB (films/TV). May be empty.
- `rank: number` - The item's position within its category in the user's Trove. Rank 1 is the user's top pick.
- `external_id?: string` - Optional identifier linking to the external media source. For books this is an Open Library work key (e.g. `/works/OL123W`), for films and TV it is a prefixed TMDB ID (e.g. `tmdb:12345`). Used to link to media detail pages and to match items across users.

**Used in:** ItemGrid, useUserLibrary, and throughout the Trove, Social, and Explore pages.
