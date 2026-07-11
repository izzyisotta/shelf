"use client";

import { useAuth } from "@/components/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import Logo from "@/components/Logo";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.push("/trove");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center max-w-lg px-6">
        <Logo className="h-14 w-auto mx-auto mb-8" />
        <h1 className="font-serif text-3xl sm:text-4xl text-foreground mb-4 leading-tight">
          Your taste, ranked.<br />Your friends, compared.
        </h1>
        <p className="text-muted mb-10">
          Books, films and TV, kept where they belong.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/signup"
            className="px-8 py-3 bg-accent text-background rounded-lg font-medium hover:bg-accent-hover transition-colors"
          >
            Get started
          </Link>
          <Link
            href="/login"
            className="px-8 py-3 bg-surface text-foreground rounded-lg font-medium border border-border hover:bg-surface-hover transition-colors"
          >
            Log in
          </Link>
        </div>
      </div>
    </div>
  );
}
