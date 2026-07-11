"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUserLibrary } from "@/hooks/useUserLibrary";
import { Item } from "@/types/item";

interface Friend {
  id: string;
  username: string;
  display_name: string;
}

interface Message {
  id: string;
  body: string;
  created_at: string;
  author: { id: string; username: string; display_name: string };
  recipients: { id: string; username: string; display_name: string }[];
}

interface Props {
  items: Item[];
  category: "book" | "film" | "tv";
  editable?: boolean;
  onDelete?: (id: string) => void;
  onReorder?: (items: { id: string; rank: number }[]) => void;
  showComments?: boolean;
  viewingUserId?: string;
  onAdd?: (item: Item) => void;
  addedItems?: Set<string>;
  onRecommend?: (item: Item) => void;
}

// Inline SVG icons
function RecommendIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5l0-3" />
      <path d="M5 12l-3 0" />
      <path d="M19 12l3 0" />
      <path d="M7.05 7.05l-2.12-2.12" />
      <path d="M16.95 7.05l2.12-2.12" />
      <path d="M12 9a4 4 0 0 1 4 4c0 2-2 4-4 6-2-2-4-4-4-6a4 4 0 0 1 4-4z" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export default function ItemGrid({ items, category, editable = false, onDelete, onReorder, showComments = false, onAdd, addedItems, onRecommend }: Props) {
  const router = useRouter();
  const library = useUserLibrary();

  // Drag state
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  // Message modal state
  const [messageItem, setMessageItem] = useState<Item | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);

  // Recommend state
  const [recommendItem, setRecommendItem] = useState<Item | null>(null);
  const [recommendFriends, setRecommendFriends] = useState<Friend[]>([]);
  const [loadingRecommend, setLoadingRecommend] = useState(false);
  const [recommendToast, setRecommendToast] = useState<string | null>(null);
  const [alreadyHasItem, setAlreadyHasItem] = useState<{ friendId: string; friendName: string } | null>(null);

  const categoryLabel = category === "book" ? "Books" : category === "film" ? "Films" : "TV Shows";
  const filtered = items.filter((i) => i.category === category).sort((a, b) => a.rank - b.rank);

  // Drag handlers
  function handleDragStart(index: number) {
    dragItem.current = index;
    setDragIndex(index);
  }

  function handleDragEnter(index: number) {
    dragOverItem.current = index;
  }

  function handleDragEnd() {
    if (dragItem.current === null || dragOverItem.current === null || dragItem.current === dragOverItem.current) {
      setDragIndex(null);
      return;
    }
    const reordered = [...filtered];
    const [dragged] = reordered.splice(dragItem.current, 1);
    reordered.splice(dragOverItem.current, 0, dragged);
    const updates = reordered.map((item, i) => ({ id: item.id, rank: i + 1 }));
    if (onReorder) onReorder(updates);
    dragItem.current = null;
    dragOverItem.current = null;
    setDragIndex(null);
  }

  // Message modal
  async function openMessageModal(item: Item) {
    setMessageItem(item);
    setLoadingMessages(true);
    setNewMessage("");
    setSelectedRecipients([]);

    const [messagesRes, friendsRes] = await Promise.all([
      fetch(`/api/messages?itemId=${item.id}`),
      fetch("/api/friends/list"),
    ]);
    const [messagesData, friendsData] = await Promise.all([
      messagesRes.json(),
      friendsRes.json(),
    ]);

    setMessages(messagesData.messages || []);
    setFriends(friendsData.friends || []);

    // Default recipients from last message
    const msgs = messagesData.messages || [];
    if (msgs.length > 0) {
      const lastMsg = msgs[msgs.length - 1];
      setSelectedRecipients(lastMsg.recipients.map((r: { id: string }) => r.id));
    }
    setLoadingMessages(false);
  }

  function toggleRecipient(id: string) {
    setSelectedRecipients((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    );
  }

  async function sendMessage() {
    if (!messageItem || !newMessage.trim() || selectedRecipients.length === 0) return;
    setSending(true);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: messageItem.id, body: newMessage.trim(), recipientIds: selectedRecipients }),
      });
      const data = await res.json();
      if (data.ok) {
        setMessages((prev) => [...prev, data.message]);
        setNewMessage("");
      } else {
        alert(`Send failed: ${data.error || "Unknown error"}`);
      }
    } catch (err) {
      alert("Send error - check console");
      console.error(err);
    }
    setSending(false);
  }

  // Recommend flow
  async function openRecommendModal(item: Item) {
    if (onRecommend) {
      // If parent handles recommend (legacy), use that
      onRecommend(item);
      return;
    }
    setRecommendItem(item);
    setLoadingRecommend(true);
    const res = await fetch("/api/friends/list");
    const data = await res.json();
    setRecommendFriends(data.friends || []);
    setLoadingRecommend(false);
  }

  async function selectRecommendFriend(friendId: string, friendName: string) {
    if (!recommendItem) return;

    // Check if friend already has this item
    try {
      const res = await fetch(`/api/items?userId=${friendId}&category=${recommendItem.category}`);
      const data = await res.json();
      const friendItems: Item[] = data.items || [];
      const alreadyHas = friendItems.some(
        (i) => i.title.toLowerCase() === recommendItem.title.toLowerCase()
      );

      if (alreadyHas) {
        setAlreadyHasItem({ friendId, friendName });
        return;
      }
    } catch {
      // If check fails, proceed with recommend anyway
    }

    await sendRecommend(friendId, friendName);
  }

  async function sendRecommend(friendId: string, friendName: string) {
    if (!recommendItem) return;
    try {
      const res = await fetch("/api/recommended/friend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toUserId: friendId,
          category: recommendItem.category,
          title: recommendItem.title,
          creator: recommendItem.creator,
          coverUrl: recommendItem.cover_url,
        }),
      });
      if (res.ok) {
        setRecommendToast(`Sent to ${friendName}`);
      } else if (res.status === 409) {
        setRecommendToast(`Already sent to ${friendName}`);
      }
    } catch {
      setRecommendToast("Failed to send");
    }
    setRecommendItem(null);
    setAlreadyHasItem(null);
    setTimeout(() => setRecommendToast(null), 2500);
  }

  function pivotToChat() {
    if (!recommendItem || !alreadyHasItem) return;
    const item = recommendItem;
    setRecommendItem(null);
    setAlreadyHasItem(null);
    openMessageModal(item);
    // Pre-select the friend
    setSelectedRecipients([alreadyHasItem.friendId]);
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  if (filtered.length === 0) {
    return (
      <div className="text-center py-8 text-muted">
        <p className="mt-2">No {categoryLabel.toLowerCase()} yet</p>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {filtered.map((item, index) => (
          <div
            key={item.id}
            draggable={editable && !!onReorder}
            onDragStart={() => handleDragStart(index)}
            onDragEnter={() => handleDragEnter(index)}
            onDragEnd={handleDragEnd}
            onDragOver={(e) => e.preventDefault()}
            className={`group relative flex flex-col bg-surface rounded-xl border border-border overflow-hidden hover:border-accent/40 transition-all ${
              editable && onReorder ? "cursor-grab active:cursor-grabbing" : ""
            } ${dragIndex === index ? "opacity-40 scale-95" : ""}`}
          >
            <div className="absolute top-2 left-2 bg-accent text-background text-xs font-mono font-semibold w-6 h-6 rounded-full flex items-center justify-center z-10">
              {item.rank}
            </div>
            {editable && onDelete && (
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
                className="absolute top-2 right-2 bg-black/50 text-muted backdrop-blur-sm text-xs w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-60 hover:!opacity-100 hover:bg-red-500/80 hover:text-white transition-all z-10"
              >
                &times;
              </button>
            )}
            {onAdd && (() => {
              const status = library.statusLabel(item.title, item.category);
              const isAdded = addedItems?.has(item.id);
              if (status) {
                return (
                  <span className="absolute top-2 right-2 text-xs font-medium px-2 py-1 rounded-lg z-10 bg-surface-hover text-muted-light opacity-100 border border-border">
                    {status}
                  </span>
                );
              }
              if (isAdded) {
                return (
                  <span className="absolute top-2 right-2 text-xs font-medium px-2 py-1 rounded-lg z-10 bg-surface-hover text-muted-light opacity-100">
                    Added
                  </span>
                );
              }
              return (
                <button
                  onClick={(e) => { e.stopPropagation(); onAdd(item); }}
                  className="absolute top-2 right-2 text-xs font-medium px-2 py-1 rounded-lg z-10 transition-all bg-accent-muted text-accent hover:bg-accent hover:text-background opacity-0 group-hover:opacity-100"
                >
                  + Up Next
                </button>
              );
            })()}
            <div
              className={`flex-1 ${item.external_id ? "cursor-pointer" : ""}`}
              onClick={() => {
                if (item.external_id) {
                  router.push(`/media/${item.category}/${item.external_id}`);
                }
              }}
            >
              {item.cover_url ? (
                <img src={item.cover_url} alt={item.title} className="w-full h-48 object-cover" draggable={false} />
              ) : (
                <div className="w-full h-48 bg-surface-hover flex items-center justify-center">
                  <span className="text-muted text-sm">{categoryLabel.slice(0, -1)}</span>
                </div>
              )}
              <div className="p-3">
                <h3 className="font-medium text-sm text-foreground line-clamp-2">{item.title}</h3>
                {item.creator && <p className="text-xs text-muted mt-1">{item.creator}</p>}
                {item.year && <p className="text-xs text-muted-light">{item.year}</p>}
              </div>
            </div>
            <div className="px-3 pb-3">
              {/* Action buttons - always visible on hover */}
              <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => { e.stopPropagation(); openRecommendModal(item); }}
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium px-2 py-1.5 rounded-lg bg-accent-muted text-accent hover:bg-accent hover:text-background transition-all"
                  title="Recommend"
                >
                  <RecommendIcon />
                  <span>Recommend</span>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); openMessageModal(item); }}
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium px-2 py-1.5 rounded-lg bg-surface-hover text-muted hover:bg-accent hover:text-background border border-border hover:border-accent transition-all"
                  title="Chat"
                >
                  <ChatIcon />
                  <span>Chat</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recommend friend picker modal */}
      {recommendItem && !onRecommend && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => { setRecommendItem(null); setAlreadyHasItem(null); }}>
          <div className="bg-surface rounded-xl border border-border max-w-sm w-full max-h-[60vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-5">
              {alreadyHasItem ? (
                <>
                  <h3 className="font-semibold text-foreground mb-2">They already have this!</h3>
                  <p className="text-sm text-muted mb-4">
                    {alreadyHasItem.friendName} already has <span className="font-medium text-foreground">{recommendItem.title}</span> in their Trove. Want to chat about it instead?
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={pivotToChat}
                      className="flex-1 px-4 py-2.5 bg-accent text-background rounded-lg text-sm font-medium hover:bg-accent-hover transition-colors"
                    >
                      Chat about it
                    </button>
                    <button
                      onClick={() => sendRecommend(alreadyHasItem.friendId, alreadyHasItem.friendName)}
                      className="flex-1 px-4 py-2.5 bg-surface-hover text-muted rounded-lg text-sm border border-border hover:text-foreground transition-colors"
                    >
                      Send anyway
                    </button>
                  </div>
                  <button
                    onClick={() => { setRecommendItem(null); setAlreadyHasItem(null); }}
                    className="mt-3 w-full py-2 text-sm text-muted hover:text-foreground transition-colors"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <h3 className="font-semibold text-foreground mb-4">Send to a friend</h3>
                  {loadingRecommend ? (
                    <p className="text-sm text-muted py-4 text-center">Loading friends...</p>
                  ) : recommendFriends.length === 0 ? (
                    <p className="text-sm text-muted py-4 text-center">No friends yet. Add some first!</p>
                  ) : (
                    <div className="space-y-1">
                      {recommendFriends.map((f) => (
                        <button
                          key={f.id}
                          onClick={() => selectRecommendFriend(f.id, f.display_name || f.username)}
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
                    onClick={() => { setRecommendItem(null); setAlreadyHasItem(null); }}
                    className="mt-4 w-full py-2 text-sm text-muted hover:text-foreground transition-colors"
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Message modal */}
      {messageItem && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setMessageItem(null)}>
          <div className="bg-surface rounded-xl border border-border max-w-md w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-start gap-4 mb-4">
                {messageItem.cover_url ? (
                  <img src={messageItem.cover_url} alt="" className="w-16 h-24 object-cover rounded" />
                ) : (
                  <div className="w-16 h-24 bg-surface-hover rounded flex items-center justify-center text-sm text-muted">
                    {categoryLabel.slice(0, -1)}
                  </div>
                )}
                <div>
                  <h3 className="font-semibold text-foreground">{messageItem.title}</h3>
                  {messageItem.creator && <p className="text-sm text-muted">{messageItem.creator}</p>}
                  <p className="text-sm text-accent font-medium">Ranked #{messageItem.rank}</p>
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <h4 className="font-medium text-foreground mb-3">Messages</h4>
                {loadingMessages ? (
                  <p className="text-muted text-sm">Loading...</p>
                ) : messages.length === 0 ? (
                  <p className="text-muted text-sm">No messages yet. Start the conversation!</p>
                ) : (
                  <div className="space-y-3 mb-4 max-h-48 overflow-y-auto">
                    {messages.map((m) => (
                      <div key={m.id} className="bg-background rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-foreground">
                            {m.author.display_name || m.author.username}
                          </span>
                          <span className="text-xs text-muted-light">
                            {timeAgo(m.created_at)}
                          </span>
                        </div>
                        <p className="text-sm text-muted">{m.body}</p>
                        {m.recipients.length > 0 && (
                          <p className="text-xs text-muted-light mt-1">
                            to {m.recipients.map((r) => r.display_name || r.username).join(", ")}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Friend picker pills */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {friends.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => toggleRecipient(f.id)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                        selectedRecipients.includes(f.id)
                          ? "bg-accent text-background border-accent"
                          : "bg-surface-hover text-muted border-border hover:border-accent/40"
                      }`}
                    >
                      {f.display_name || f.username}
                    </button>
                  ))}
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                    placeholder="Write a message..."
                    className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-light focus:ring-2 focus:ring-accent focus:border-transparent"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!newMessage.trim() || selectedRecipients.length === 0 || sending}
                    className="px-4 py-2 bg-accent text-background rounded-lg text-sm hover:bg-accent-hover disabled:opacity-50"
                  >
                    Send
                  </button>
                </div>
                {selectedRecipients.length === 0 && newMessage.trim() && (
                  <p className="text-xs text-accent mt-1">Select friends to send to</p>
                )}
              </div>

              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => {
                    const id = messageItem.id;
                    setMessageItem(null);
                    router.push(`/item/${id}`);
                  }}
                  className="flex-1 py-2 text-sm text-accent hover:text-accent-hover font-medium"
                >
                  View full thread
                </button>
                <button
                  onClick={() => setMessageItem(null)}
                  className="flex-1 py-2 text-sm text-muted hover:text-foreground"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {recommendToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-surface border border-accent/40 text-foreground text-sm px-4 py-2.5 rounded-xl shadow-lg z-50">
          {recommendToast}
        </div>
      )}
    </div>
  );
}
