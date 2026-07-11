"use client";

import { useState, useEffect } from "react";

interface Friend {
  id: string;
  username: string;
  display_name: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (friendId: string, friendName: string) => void;
}

export default function FriendPickerModal({ isOpen, onClose, onSelect }: Props) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    fetch("/api/friends/list")
      .then((res) => res.json())
      .then((data) => setFriends(data.friends || []))
      .catch(() => setFriends([]))
      .finally(() => setLoading(false));
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-surface rounded-xl border border-border max-w-sm w-full max-h-[60vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5">
          <h3 className="font-semibold text-foreground mb-4">Send to a friend</h3>

          {loading ? (
            <p className="text-sm text-muted py-4 text-center">Loading friends...</p>
          ) : friends.length === 0 ? (
            <p className="text-sm text-muted py-4 text-center">No friends yet. Add some first!</p>
          ) : (
            <div className="space-y-1">
              {friends.map((f) => (
                <button
                  key={f.id}
                  onClick={() => onSelect(f.id, f.display_name || f.username)}
                  className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-surface-hover transition-colors flex items-center gap-3"
                >
                  <div className="w-8 h-8 rounded-full bg-accent-muted flex items-center justify-center flex-shrink-0">
                    <span className="text-accent text-sm font-bold">
                      {(f.display_name || f.username).charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span className="text-sm font-medium text-foreground">
                    {f.display_name || f.username}
                  </span>
                </button>
              ))}
            </div>
          )}

          <button
            onClick={onClose}
            className="mt-4 w-full py-2 text-sm text-muted hover:text-foreground transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
