# API Routes

All API routes are Next.js App Router route handlers. Every route (except auth endpoints) requires an authenticated Supabase session, enforced server-side via `supabase.auth.getUser()`. Unauthenticated requests receive a 401 response.

## Auth

### `POST /api/auth/signup`

Creates a new user account. Accepts `{ username, email, password, displayName? }`. The username is checked for uniqueness against the profiles table before calling Supabase Auth's `signUp`. A database trigger automatically creates the corresponding profile row. Returns `{ ok: true, user: { id, username } }` on success, or 409 if the username is taken.

### `POST /api/auth/login`

Signs in an existing user with `{ login, password }`. The `login` field must be an email address (username login is stubbed but not yet implemented). Returns `{ ok: true, user: { id, username, display_name } }` on success, or 401 for invalid credentials.

### `POST /api/auth/logout`

Signs out the current user by calling `supabase.auth.signOut()`. Returns `{ ok: true }`.

### `GET /api/auth/me`

Returns the current user's profile including `id`, `email`, `username`, `display_name`, and `bio`. Returns `{ user: null }` with status 401 if not authenticated.

## Items (Trove)

### `GET /api/items`

Fetches a user's ranked Trove items. Accepts optional query params `userId` (defaults to current user) and `category` (filter by book/film/tv). Returns `{ items: Item[] }` sorted by rank ascending.

### `POST /api/items`

Adds a new item to the current user's Trove. Accepts `{ category, title, creator?, year?, coverUrl?, externalId? }`. The item is automatically assigned the next rank in its category. Returns `{ ok: true, item }` or 500 on duplicate.

### `PUT /api/items`

Batch-updates item ranks for drag-and-drop reordering. Accepts `{ items: { id, rank }[] }`. Only updates items owned by the current user. Returns `{ ok: true }`.

### `DELETE /api/items`

Removes an item from the current user's Trove. Accepts `{ id }`. Returns `{ ok: true }`.

### `GET /api/items/[itemId]`

Fetches a single item by UUID, including the owner's profile (`username` and `display_name`). Returns `{ item }` with an `owner` field, or 404 if not found.

## Friends

### `POST /api/friends/request`

Sends a friend request. Accepts `{ username }`. Looks up the target user by username, checks for self-friending and duplicate requests, then inserts a pending friendship row. Returns `{ ok: true }`, 404 if user not found, or 409 if a request already exists.

### `POST /api/friends/accept`

Accepts or rejects a pending friend request. Accepts `{ friendshipId, action }` where action is "accept" or "reject". Only the addressee can update the friendship status. Returns `{ ok: true }`.

### `GET /api/friends/list`

Returns all accepted friends for the current user. Each friend includes `id`, `username`, `display_name`, and `friendship_id`. Returns `{ friends: Friend[] }`.

### `GET /api/friends/requests`

Returns pending friend requests in both directions. Returns `{ incoming, outgoing }` where each entry includes `friendship_id`, `username`, and `display_name`.

### `GET /api/friends/activity`

Returns a feed of the 20 most recent items added by friends, sorted by creation date. Each entry includes item details and the friend's profile. Returns `{ activity: ActivityItem[] }`.

## Messages

### `GET /api/messages?itemId=<uuid>`

Fetches all messages on a specific item that the current user can see (either as author or recipient). Messages are sorted chronologically and enriched with author profiles and recipient lists. Returns `{ messages: EnrichedMessage[] }`.

### `POST /api/messages`

Sends a new message. Accepts `{ itemId, body, recipientIds: string[] }`. Creates the message row and all recipient entries, then returns the enriched message with author and recipient profiles. Returns `{ ok: true, message }`.

### `GET /api/messages/incoming`

Returns the 20 most recent messages sent to the current user (excluding messages they authored). Each message is enriched with the author's profile and the associated item's details. Returns `{ messages: IncomingMessage[] }`.

### `GET /api/conversations`

Returns all conversations the current user is involved in, grouped by item and conversation partner. Each conversation includes the item details, the other person's profile, the last message preview, and a message count. Sorted by most recent activity. Returns `{ conversations: Conversation[] }`.

## Recommendations (Up Next list)

### `GET /api/recommended`

Fetches the current user's full Up Next list, merging items from two sources: the `recommended` table (self-added and AI picks) and the `friend_recommendations` table (items sent by friends, excluding declined ones). Each item is tagged with a `source_type` of "self", "ai", "from-shelf", or "friend". Returns `{ items: UpNextItem[] }` sorted by creation date.

### `POST /api/recommended`

Adds an item to the current user's Up Next list. Accepts `{ category, title, creator?, source?, notes? }`. Returns `{ ok: true, item }` or 409 if already present.

### `PATCH /api/recommended`

Updates an Up Next item's notes or status. Accepts `{ id, notes?, table?, status? }`. The `table` field determines whether to update in `recommended` or `friend_recommendations`. Returns `{ ok: true }`.

### `DELETE /api/recommended`

Removes an item from the Up Next list. Accepts `{ id, table? }`. The `table` field determines which source table to delete from. Returns `{ ok: true }`.

### `POST /api/recommended/friend`

Sends a recommendation to a friend. Accepts `{ toUserId, category, title, creator?, coverUrl? }`. Returns `{ ok: true, item }` or 409 if already recommended to that person.

## AI Recommendations

### `GET /api/recommend?friendId=<uuid>`

Returns cached AI taste-match results for the current user and a specific friend. Returns `{ recommendation, created_at }` if cached, or `{ recommendation: null }` if not yet generated.

### `POST /api/recommend`

Generates a new AI taste-match analysis between the current user and a friend. Accepts `{ friendId }`. Fetches both users' ranked items, sends them to Claude Sonnet with a structured prompt, and caches the result in `match_recommendations`. The response includes a vibe summary, common ground observations, taste differences, picks from the friend's list, and new recommendations for both. Returns `{ recommendation, created_at }`.

### `GET /api/recommend/personal`

Returns cached personal AI recommendations for the current user. Returns `{ recommendation, created_at }` if cached, or `{ recommendation: null }` if not yet generated.

### `POST /api/recommend/personal`

Generates new personal AI recommendations. Requires at least 3 items in the user's Trove. Sends the user's ranked list to Claude Sonnet, excluding items already in their Trove or Up Next list, and caches the result. Returns a taste profile analysis and 8-10 picks across categories. Returns `{ recommendation, created_at }`.

## Media (External APIs)

### `GET /api/search-media?q=<query>&category=<book|film|tv>`

Searches external media APIs for matching titles. Books use Open Library, films use TMDB movie search, and TV uses TMDB TV search. Returns up to 8 results, each with `title`, `creator`, `year`, `coverUrl`, and `externalId`. Returns `{ results: MediaResult[] }`.

### `GET /api/media/[category]/[...externalId]`

Fetches detailed information about a specific title from the appropriate external API (TMDB for films/TV, Open Library for books). Returns the media detail (title, overview, year, poster, genres, cast/author, etc.) along with social context: whether the current user has it in their Trove or Up Next list, which friends also have it, and any existing conversations about it. Returns `{ detail: MediaDetail, social: SocialContext }`.

## Taste Matching

### `GET /api/match?friendId=<uuid>`

Compares the current user's Trove with a friend's. Requires an accepted friendship. Returns shared items (sorted by combined rank, a "closeness" score), items unique to each person, and overall stats. Returns `{ friend, matches: Match[], onlyMine, onlyTheirs, stats }`.

## Incoming Nudges

### `GET /api/incoming/nudges`

Generates social nudges based on taste overlap. Finds friends who share at least one Trove item with the current user, then surfaces other items those friends have that the user does not. Results are ranked by how many taste-aligned friends share each item, capped at 10 nudges. Returns `{ nudges: Nudge[] }` where each nudge includes the item details, a human-readable reason, and the list of friends who have it.
