# Trove

Trove is a social media app for books, films, and TV shows. Users build a ranked personal library (their "Trove"), maintain an "Up Next" list of things they want to consume, and connect with friends to compare taste, send recommendations, and chat about specific titles. An AI layer powered by the Claude API generates personalised recommendations based on each user's ranked list, as well as taste-match analyses between pairs of friends.

## Stack

- **Framework:** Next.js 16 (App Router) with React 19
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS v4
- **Database & Auth:** Supabase (PostgreSQL with Row Level Security, cookie-based auth via `@supabase/ssr`)
- **AI:** Anthropic Claude API (Claude Sonnet) for personal and friend-match recommendations
- **Media APIs:** TMDB (films, TV) and Open Library (books) for search and detail pages
- **Fonts:** Geist Sans and Geist Mono via `next/font`

## Running locally

```bash
npm install
```

Create a `.env.local` file at the project root with the following variables:

```
NEXT_PUBLIC_SUPABASE_URL=<your Supabase project URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your Supabase anon/public key>
TMDB_API_KEY=<your TMDB API key>
ANTHROPIC_API_KEY=<your Anthropic API key>
```

Set up the database by running the contents of `supabase-schema.sql` in the Supabase SQL Editor. This creates all tables, indexes, RLS policies, and the auto-profile trigger.

Then start the dev server:

```bash
npx next dev
```

The app will be available at `http://localhost:3000`. Authenticated users are redirected to `/trove`; unauthenticated users see a landing page with links to sign up or log in.

## Project structure

```
src/
  app/                  # Next.js App Router pages and API routes
    api/                # Server-side API routes (see src/app/api/README.md)
    trove/              # "My Trove" section: ranked library + Up Next list
    explore/            # "Explore" section: incoming nudges + AI discovery
    social/             # "Friends" section: people list, compare, groups
    messages/           # Conversations inbox
    media/[category]/   # External media detail pages (TMDB/Open Library)
    item/[itemId]/      # Individual item detail + message thread
    login/              # Login page
    signup/             # Signup page
  components/           # Shared React components (see src/components/README.md)
  hooks/                # Custom React hooks (see src/hooks/README.md)
  lib/                  # Supabase client factories (browser + server)
  types/                # Shared TypeScript types (see src/types/README.md)
supabase-schema.sql     # Full database schema: tables, indexes, RLS, triggers
```

## Key concepts

**Trove** is a user's ranked collection of books, films, and TV shows they have already consumed. Items are ordered by rank within each category, and users can drag to reorder.

**Up Next** is a to-consume list that aggregates items from three sources: things the user adds manually, AI-generated picks, and recommendations sent by friends.

**Explore** surfaces new content through two channels. "Incoming" shows nudges based on what friends with overlapping taste have in their Troves. "Discover" generates AI-powered personal recommendations using the Claude API.

**Social** lets users manage friendships, compare Troves with individual friends (seeing shared items, unique items on each side, and a "closeness" score), and request AI-generated taste-match analyses.

**Messages** are item-anchored conversations. Every message is attached to a specific Trove item and directed at one or more friends, so discussions stay contextual rather than free-floating.

## Database schema

See [`supabase-schema.sql`](./supabase-schema.sql) for the full schema. The main tables are:

| Table | Purpose |
|-------|---------|
| `profiles` | User profiles, auto-created on signup via trigger |
| `items` | Ranked Trove entries (books, films, TV) |
| `recommended` | User's Up Next list (self-added and AI picks) |
| `friend_recommendations` | Recommendations sent between friends |
| `friendships` | Friend requests and accepted connections |
| `messages` | Item-anchored messages |
| `message_recipients` | Per-message recipient list |
| `match_recommendations` | Cached AI taste-match results per friend pair |
| `personal_recommendations` | Cached AI personal recommendation results per user |

All tables have Row Level Security enabled. Users can only read and modify their own data, with appropriate exceptions for social features (e.g. anyone can view profiles and items, friends can see shared messages).
