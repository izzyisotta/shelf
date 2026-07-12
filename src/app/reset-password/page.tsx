"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // The recovery link signs the user in when the page loads (the browser
  // client exchanges the code in the URL automatically); wait for that.
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Password needs at least 8 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { error: err } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    router.push("/trove");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="bg-surface rounded-xl border border-border p-8 w-full max-w-md">
        <h1 className="font-serif text-2xl text-foreground mb-6">Choose a new password</h1>

        {!ready ? (
          <p className="text-sm text-muted">
            Checking your reset link... If this doesn&apos;t move on in a few seconds, the link may
            have expired - request a new one from the log in page.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-muted mb-1">New password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground placeholder:text-muted-light focus:ring-2 focus:ring-accent focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted mb-1">Confirm password</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground placeholder:text-muted-light focus:ring-2 focus:ring-accent focus:border-transparent"
              />
            </div>

            {error && <p className="text-accent text-sm">{error}</p>}

            <button
              type="submit"
              disabled={saving}
              className="w-full py-3 bg-accent text-background rounded-lg font-medium hover:bg-accent-hover disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving..." : "Set new password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
