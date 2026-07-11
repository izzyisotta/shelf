"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./AuthContext";

function TroveIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v15" />
      <path d="M8 20V7a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v13" />
      <path d="M13.5 20 11 6.5a1 1 0 0 1 .8-1.2l2-.4a1 1 0 0 1 1.2.8L17.5 19" />
      <path d="M2 20h20" />
    </svg>
  );
}

function ExploreIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2 5-5 2 2-5z" />
    </svg>
  );
}

function MessagesIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function FriendsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

const tabs = [
  { label: "My Trove", href: "/trove", icon: <TroveIcon /> },
  { label: "Explore", href: "/explore", icon: <ExploreIcon /> },
  { label: "Messages", href: "/messages", icon: <MessagesIcon /> },
  { label: "Friends", href: "/social", icon: <FriendsIcon /> },
];

export default function TabBar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  if (!user) return null;

  function isActive(href: string) {
    return pathname.startsWith(href);
  }

  return (
    <>
      {/* Desktop: top bar */}
      <nav className="hidden md:flex bg-surface border-b border-border px-6 py-3 items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/trove" className="hover:opacity-80 transition-opacity">
            <img src="/logo.svg" alt="Trove" className="h-8" />
          </Link>
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={`text-sm font-medium transition-colors ${
                isActive(tab.href)
                  ? "text-accent"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm font-mono text-muted-light">@{user.username}</span>
          <button
            onClick={logout}
            className="text-sm text-muted-light hover:text-foreground transition-colors"
          >
            Log out
          </button>
        </div>
      </nav>

      {/* Mobile: slim top bar */}
      <nav className="md:hidden bg-surface border-b border-border px-4 py-3 flex items-center justify-between">
        <Link href="/trove" className="hover:opacity-80 transition-opacity">
          <img src="/logo.svg" alt="Trove" className="h-7" />
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-sm font-mono text-muted-light">@{user.username}</span>
          <button
            onClick={logout}
            className="text-sm text-muted-light hover:text-foreground transition-colors"
          >
            Log out
          </button>
        </div>
      </nav>

      {/* Mobile: bottom tab bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-surface border-t border-border z-40 flex">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex-1 flex flex-col items-center py-2.5 text-xs font-medium transition-colors ${
              isActive(tab.href)
                ? "text-accent"
                : "text-muted"
            }`}
          >
            <span className="mb-1">{tab.icon}</span>
            {tab.label}
          </Link>
        ))}
      </div>
    </>
  );
}
