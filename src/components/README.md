# Components

Shared React components used across the Trove app. All client components are marked with `"use client"` at the top of the file.

## AuthContext

**File:** `AuthContext.tsx`

Provides authentication state to the entire app via React Context. The `AuthProvider` wraps the app in the root layout and fetches the current user's profile from `/api/auth/me` on mount. It exposes `user` (the current user object or null), `loading` (whether the initial auth check is still in progress), `refresh` (to re-fetch the user after login), and `logout` (to sign out via Supabase and clear the user state). Components consume this context through the `useAuth()` hook exported from the same file.

**Used in:** Root layout (`src/app/layout.tsx`), TabBar, and every page that needs to check authentication.

**Key exports:**
- `AuthProvider` - Context provider component. Props: `{ children: ReactNode }`.
- `useAuth()` - Hook returning `{ user, loading, refresh, logout }`.

## TabBar

**File:** `TabBar.tsx`

The app's primary navigation bar, rendered in the root layout for all authenticated users. On desktop it displays as a horizontal top bar with the Trove logo, navigation links (My Trove, Explore, Messages, Friends), the current username, and a logout button. On mobile it renders a slim top bar (logo + username) plus a fixed bottom tab bar with emoji icons. The active tab is determined by matching the current pathname. The component is hidden entirely when no user is logged in.

**Used in:** Root layout (`src/app/layout.tsx`).

**Props:** None (reads auth state from `useAuth()` and route from `usePathname()`).

## SubNav

**File:** `SubNav.tsx`

A pill-style secondary navigation bar used within sections that have sub-tabs. Each pill is a Next.js `Link` with active state styling (coral background for the current tab, bordered surface for inactive tabs). The `defaultHref` prop handles the case where the parent route redirects to a default sub-route.

**Used in:** Trove layout (Trove / Up Next tabs), Explore layout (Incoming / Discover tabs), Social layout (My People / My Groups tabs).

**Props:**
- `items: { label: string, href: string }[]` - The sub-navigation items to render.
- `defaultHref: string` - The href that should appear active when the user is on the parent route.

## ItemGrid

**File:** `ItemGrid.tsx`

The main display component for Trove items. It renders a responsive grid of media cards, each showing a cover image, rank badge, title, creator, and year. The component supports several interaction modes depending on its props.

In editable mode, items are draggable for reordering (via HTML5 drag-and-drop) and show a delete button on hover. In non-editable mode (e.g. viewing a friend's Trove), items can show an "Add to Up Next" button instead. Every card has "Recommend" and "Chat" action buttons that appear on hover. Recommend opens a friend-picker modal and checks whether the selected friend already has the item, offering to pivot to a chat if so. Chat opens an inline message modal showing the conversation thread on that item, with friend-picker pills for selecting recipients. Clicking a card's cover or title navigates to the media detail page if the item has an `external_id`.

**Used in:** Trove consumed page, friend comparison page, and anywhere items are displayed in a grid.

**Props:**
- `items: Item[]` - The items to display.
- `category: "book" | "film" | "tv"` - Which category to filter and display.
- `editable?: boolean` - Whether drag-to-reorder and delete are enabled.
- `onDelete?: (id: string) => void` - Callback when the delete button is clicked.
- `onReorder?: (items: { id: string, rank: number }[]) => void` - Callback after drag-and-drop reorder.
- `showComments?: boolean` - Whether to show comment indicators (currently unused).
- `viewingUserId?: string` - The user whose items are being viewed (for ownership checks).
- `onAdd?: (item: Item) => void` - Callback for the "Add to Up Next" button.
- `addedItems?: Set<string>` - Item IDs that have already been added (to show "Added" state).
- `onRecommend?: (item: Item) => void` - Legacy external recommend handler; if provided, bypasses the built-in friend-picker modal.

## MediaSearch

**File:** `MediaSearch.tsx`

A search-as-you-type input that queries external media APIs (Open Library for books, TMDB for films and TV) via the `/api/search-media` endpoint. It debounces input by 300ms and displays results in a dropdown below the input, each showing a thumbnail, title, creator, and year. Selecting a result calls the `onSelect` callback and clears the search field. Clicking outside the dropdown dismisses it.

**Used in:** Trove consumed page (for adding new items) and Up Next page (for adding items to the to-consume list).

**Props:**
- `category: "book" | "film" | "tv"` - Which media type to search.
- `onSelect: (result: MediaResult) => void` - Callback when a search result is selected. The result includes `title`, `creator`, `year`, `coverUrl`, and `externalId`.

## FriendPickerModal

**File:** `FriendPickerModal.tsx`

A modal overlay that displays the current user's friends list for selection. When opened, it fetches the friend list from `/api/friends/list` and renders each friend as a button with an avatar initial and display name. Selecting a friend calls `onSelect` with the friend's ID and name, then the parent is responsible for closing the modal.

**Used in:** Explore discover page (for sending AI recommendation picks to friends).

**Props:**
- `isOpen: boolean` - Controls modal visibility.
- `onClose: () => void` - Called when the backdrop or cancel button is clicked.
- `onSelect: (friendId: string, friendName: string) => void` - Called when a friend is selected.

## PlaceholderSection

**File:** `PlaceholderSection.tsx`

A simple "coming soon" placeholder card used for features that are not yet built. It renders a centered card with a title, description, and a "Coming soon" label.

**Used in:** Social groups page.

**Props:**
- `title: string` - The section heading.
- `description: string` - A short explanation of what the section will contain.
