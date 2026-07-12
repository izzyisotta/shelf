"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthContext";
import Logo from "@/components/Logo";

interface Teaser {
  username: string;
  displayName: string;
  counts: { book: number; film: number; tv: number };
  top: { title: string; cover_url: string; category: string }[];
}

export default function JoinPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = use(params);
  const { user, loading } = useAuth();
  const router = useRouter();
  const [teaser, setTeaser] = useState<Teaser | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/public-profile?username=${encodeURIComponent(username)}`)
      .then((r) => r.json())
      .then((d) => (d.error ? setNotFound(true) : setTeaser(d)))
      .catch(() => setNotFound(true));
  }, [username]);

  // Already logged in: redeem the link straight away
  useEffect(() => {
    if (loading || !user || joining) return;
    setJoining(true);
    fetch("/api/friends/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          router.push(`/social/people/compare?friendId=${d.friendId}`);
        } else {
          setError(d.error || "Couldn't connect you");
          setJoining(false);
        }
      })
      .catch(() => {
        setError("Couldn't connect you, try again");
        setJoining(false);
      });
  }, [user, loading, username, router, joining]);

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center">
          <Logo className="h-10 w-auto mx-auto mb-6" />
          <p className="text-muted">That link doesn&apos;t point anywhere.</p>
        </div>
      </div>
    );
  }

  const name = teaser?.displayName || username;
  const total = teaser ? teaser.counts.book + teaser.counts.film + teaser.counts.tv : 0;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <div className="text-center max-w-lg w-full">
        <Logo className="h-12 w-auto mx-auto mb-8" />

        <h1 className="font-serif text-3xl text-foreground mb-3 leading-tight">
          {name} wants to compare taste with you
        </h1>
        <p className="text-muted mb-8">
          {total > 0
            ? `${teaser!.counts.film} films, ${teaser!.counts.book} books, ${teaser!.counts.tv} shows, ranked. See what you share - and what you should consume next.`
            : "Rank your favourite books, films and TV. See what you share."}
        </p>

        {teaser && teaser.top.length > 0 && (
          <div className="flex justify-center gap-2 mb-10">
            {teaser.top.slice(0, 6).map((t, i) => (
              <img
                key={i}
                src={t.cover_url}
                alt={t.title}
                title={t.title}
                className="w-14 h-21 sm:w-16 sm:h-24 object-cover rounded-sm border border-border"
              />
            ))}
          </div>
        )}

        {user ? (
          <p className="text-muted text-sm">{error || "Connecting you..."}</p>
        ) : (
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href={`/signup?from=${encodeURIComponent(username)}`}
              className="px-8 py-3 bg-accent text-background rounded-lg font-medium hover:bg-accent-hover transition-colors"
            >
              Sign up and compare
            </Link>
            <Link
              href={`/login?from=${encodeURIComponent(username)}`}
              className="px-8 py-3 bg-surface text-foreground rounded-lg font-medium border border-border hover:bg-surface-hover transition-colors"
            >
              I have an account
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
