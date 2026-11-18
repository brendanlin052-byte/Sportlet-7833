import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  ArrowDown,
  ArrowRight,
  Coins,
  Hash,
  LoaderCircle,
  LockKeyhole,
  MessageCircle,
  Send,
  ShieldCheck,
  Shield,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useChatMessages, useDeleteMessage, useSendMessage } from "../queries/chat";
import { Dialog } from "./dialog";
import { useAccountStatus } from "../queries/moderation";
import { ModerationPanel, OwnerBadge } from "./moderation-panel";
import { ModeratorBadge, StaffPanel } from "./staff-panel";

type Collector = { id: string; name: string };
export function CommunityChat({
  user,
  sessionLoading,
  signIn,
}: {
  user?: Collector;
  sessionLoading: boolean;
  signIn: () => void;
}) {
  const messagesQuery = useChatMessages(user?.id);
  const access = useAccountStatus(user?.id);
  const isOwner = access.data?.role === "owner";
  const isStaff = isOwner || access.data?.role === "moderator";
  const [staffOpen, setStaffOpen] = useState(false);
  const isMuted = !!access.data?.muted;
  const [moderationOpen, setModerationOpen] = useState(false);
  const [moderationTarget, setModerationTarget] = useState<string | undefined>();
  const send = useSendMessage();
  const remove = useDeleteMessage();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [rewardNote, setRewardNote] = useState("");
  const [coolingDown, setCoolingDown] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [unread, setUnread] = useState(false);
  const feed = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  const olderHeight = useRef<number | null>(null);
  const messages = useMemo(() => {
    const unique = new Map<
      number,
      NonNullable<typeof messagesQuery.data>["pages"][number]["messages"][number]
    >();
    messagesQuery.data?.pages.forEach((page) =>
      page.messages.forEach((message) => unique.set(message.id, message)),
    );
    return [...unique.values()].sort((a, b) => a.id - b.id);
  }, [messagesQuery.data]);
  const newestId = messages.at(-1)?.id;
  const oldestId = messages[0]?.id;
  useEffect(() => {
    const element = feed.current;
    if (!element) return;
    if (olderHeight.current !== null) {
      element.scrollTop += element.scrollHeight - olderHeight.current;
      olderHeight.current = null;
    } else if (follow.current) {
      element.scrollTop = element.scrollHeight;
      setUnread(false);
    } else if (newestId) setUnread(true);
  }, [newestId, oldestId]);
  useEffect(() => {
    if (!coolingDown) return;
    const timeout = setTimeout(() => setCoolingDown(false), 3000);
    return () => clearTimeout(timeout);
  }, [coolingDown]);
  useEffect(() => {
    setDraft("");
    setError("");
    setDeleteId(null);
    setRewardNote("");
    follow.current = true;
  }, [user?.id]);
  async function submit(event?: FormEvent) {
    event?.preventDefault();
    if (!draft.trim() || send.isPending || coolingDown || isMuted) return;
    setError("");
    const body = draft.trim();
    try {
      follow.current = true;
      const result = await send.mutateAsync({ body });
      setRewardNote(result.rewardNote);
      setDraft((current) => (current.trim() === body ? "" : current));
      setCoolingDown(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't send your message. Try again.");
    }
  }
  async function deleteMessage() {
    if (deleteId === null) return;
    setError("");
    try {
      await remove.mutateAsync({ id: deleteId });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't delete your message.");
    } finally {
      setDeleteId(null);
    }
  }
  function jumpToLatest() {
    follow.current = true;
    if (feed.current) feed.current.scrollTop = feed.current.scrollHeight;
    setUnread(false);
  }
  const dateLabel = (timestamp: number) =>
    new Date(timestamp).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  return (
    <>
      <div className="page-title">
        <div>
          <div className="eyebrow">
            <span />
            THE COLLECTORS' CLUBHOUSE
          </div>
          <h1>
            Good pulls. Great company<span>.</span>
          </h1>
          <p>Talk sports, celebrate your finds, and meet the collectors behind the rosters.</p>
        </div>
        <span className="season-tag">
          <Users size={15} /> ONE COMMUNITY. FIVE SPORTS.
        </span>
      </div>
      <div className="community-layout">
        <section className="chat-room" aria-label="Community chat">
          <header className="chat-room-header">
            <div className="channel-icon">
              <Hash size={22} />
            </div>
            <div>
              <h2>collector-lounge</h2>
              <p>Sportlet's shared community room</p>
            </div>
            <span className={`chat-connection ${messagesQuery.isError ? "connection-error" : ""}`}>
              <i />
              {!user
                ? "Members only"
                : messagesQuery.isError
                  ? "Connection issue"
                  : "Refreshes every 3s"}
            </span>
            {isOwner && (
              <button
                className="owner-tools-button"
                aria-label="Owner moderation tools"
                title="Manage collectors"
                onClick={() => {
                  setModerationTarget(undefined);
                  setModerationOpen(true);
                }}
              >
                <Shield size={18} />
              </button>
            )}
            {isStaff && <button className="owner-tools-button" aria-label="Staff progress tools" title="Manage player progress" onClick={() => setStaffOpen(true)}><ShieldCheck size={18} /></button>}
          </header>
          {sessionLoading ? (
            <div className="chat-loading">
              <LoaderCircle size={24} className="spin" />
              <p>Checking your account…</p>
            </div>
          ) : !user ? (
            <div className="chat-guest">
              <div className="guest-symbol">
                <LockKeyhole size={30} />
              </div>
              <span className="eyebrow">YOUR SEAT IN THE CLUBHOUSE</span>
              <h2>Join the conversation.</h2>
              <p>
                Sign in to read the room, share your latest pulls,
                <br />
                and talk sports with fellow collectors.
              </p>
              <button className="primary" onClick={signIn}>
                Sign in to chat
                <ArrowRight size={17} />
              </button>
              <small>Messages are shared with all signed-in collectors.</small>
            </div>
          ) : (
            <>
              {messagesQuery.isError && (
                <div className="chat-fetch-error" role="alert">
                  Couldn't refresh the room. Your draft is safe.
                  <button
                    onClick={() => messagesQuery.refetch()}
                    disabled={messagesQuery.isFetching}
                  >
                    {messagesQuery.isFetching ? "Retrying…" : "Retry"}
                  </button>
                </div>
              )}
              <div className="chat-feed-wrap">
                <div
                  className="chat-feed"
                  ref={feed}
                  role="log"
                  aria-label="Community messages"
                  aria-live="polite"
                  aria-relevant="additions"
                  onScroll={() => {
                    const element = feed.current;
                    if (element) {
                      follow.current =
                        element.scrollHeight - element.scrollTop - element.clientHeight < 70;
                      if (follow.current) setUnread(false);
                    }
                  }}
                >
                  {messagesQuery.isLoading ? (
                    <div className="chat-loading">
                      <LoaderCircle className="spin" size={24} />
                      <p>Loading the conversation…</p>
                    </div>
                  ) : (
                    <>
                      {messagesQuery.hasNextPage && (
                        <button
                          className="older-messages"
                          disabled={messagesQuery.isFetchingNextPage}
                          onClick={() => {
                            olderHeight.current = feed.current?.scrollHeight ?? null;
                            messagesQuery.fetchNextPage().catch(() => {
                              olderHeight.current = null;
                            });
                          }}
                        >
                          {messagesQuery.isFetchingNextPage ? (
                            <LoaderCircle size={14} className="spin" />
                          ) : null}
                          {messagesQuery.isFetchingNextPage
                            ? "Loading history…"
                            : "Load earlier messages"}
                        </button>
                      )}
                      <div className="room-welcome">
                        <MessageCircle size={24} />
                        <h3>Welcome to the collector lounge.</h3>
                        <p>
                          {messages.length
                            ? "A place for every sport and every collector."
                            : "No messages yet. Break the ice with your favorite sport or latest pull."}
                        </p>
                      </div>
                      {messages.map((message, index) => (
                        <div key={message.id}>
                          {(index === 0 ||
                            dateLabel(messages[index - 1]!.createdAt) !==
                              dateLabel(message.createdAt)) && (
                            <div className="chat-date">
                              <span>{dateLabel(message.createdAt)}</span>
                            </div>
                          )}
                          <article
                            className={`chat-message ${message.userId === user.id ? "own-message" : ""}`}
                            aria-label={`Message from ${message.name}`}
                          >
                            <div className="chat-avatar">
                              {message.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="message-content">
                              <div className="message-meta">
                                <strong>{message.name}</strong>
                                {message.role === "owner" && <OwnerBadge />}
                                {message.role === "moderator" && <ModeratorBadge />}
                                {message.userId === user.id && (
                                  <span className="you-badge">YOU</span>
                                )}
                                <time
                                  dateTime={new Date(message.createdAt).toISOString()}
                                  title={new Date(message.createdAt).toLocaleString()}
                                >
                                  {new Date(message.createdAt).toLocaleTimeString(undefined, {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </time>
                              </div>
                              <p>{message.body}</p>
                            </div>
                            {isOwner && message.role !== "owner" && message.userId !== user.id && (
                              <button
                                className="delete-message"
                                aria-label={`Moderate ${message.name}`}
                                title="Mute or ban collector"
                                onClick={() => {
                                  setModerationTarget(message.userId);
                                  setModerationOpen(true);
                                }}
                              >
                                <Shield size={15} />
                              </button>
                            )}
                            {message.userId === user.id && (
                              <>
                                <span
                                  className="message-coins"
                                  title={
                                    message.coinsEarned
                                      ? "3 coins earned for this message"
                                      : "This message did not earn coins"
                                  }
                                >
                                  <Coins size={11} />
                                  {message.coinsEarned ? "+3" : "+0"}
                                </span>
                                <button
                                  className="delete-message"
                                  title="Delete your message"
                                  aria-label={`Delete message ${message.id}`}
                                  disabled={remove.isPending}
                                  onClick={() => setDeleteId(message.id)}
                                >
                                  <Trash2 size={15} />
                                </button>
                              </>
                            )}
                          </article>
                        </div>
                      ))}
                    </>
                  )}
                </div>
                {unread && (
                  <button className="jump-latest" onClick={jumpToLatest}>
                    Jump to latest
                    <ArrowDown size={14} />
                  </button>
                )}
              </div>
              <form className="chat-composer" onSubmit={submit}>
                <div className="composer-identity">
                  <span className="status-dot" />
                  Chatting as <b>{user.name}</b>
                  {isOwner && <OwnerBadge />}
                  {access.data?.role === "moderator" && <ModeratorBadge />}
                </div>
                <div className="composer-input">
                  <textarea
                    aria-label="Message the collector lounge"
                    placeholder="Share a pull. Start a conversation…"
                    value={draft}
                    maxLength={500}
                    rows={2}
                    disabled={isMuted}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (
                        event.key === "Enter" &&
                        !event.shiftKey &&
                        !window.matchMedia("(pointer: coarse)").matches &&
                        !event.nativeEvent.isComposing
                      ) {
                        event.preventDefault();
                        void submit();
                      }
                    }}
                  />
                  <button
                    className="primary"
                    type="submit"
                    aria-label="Send message"
                    disabled={
                      !draft.trim() ||
                      send.isPending ||
                      coolingDown ||
                      messagesQuery.isLoading ||
                      isMuted
                    }
                  >
                    {send.isPending ? (
                      <LoaderCircle size={18} className="spin" />
                    ) : (
                      <Send size={18} />
                    )}
                    <span>{send.isPending ? "Sending" : coolingDown ? "Wait 3s" : "Send"}</span>
                  </button>
                </div>
                <div className="composer-hint">
                  <span className="keyboard-hint">Enter to send · Shift + Enter for a new line</span>
                  <span className="touch-hint">Type your message, then tap Send</span>
                  <span>{draft.length}/500</span>
                </div>
                {isMuted && (
                  <div className="chat-action-error" role="alert">
                    You are muted until {new Date(access.data!.mutedUntil).toLocaleString()}.
                    {access.data!.muteReason && ` Reason: ${access.data!.muteReason}`}
                  </div>
                )}
                <div className="chat-reward-hint">
                  <Coins size={12} />
                  <span>Earn 3 coins · 5+ characters · no repeats within 5s</span>
                </div>
                {rewardNote && <output className="chat-reward-result">{rewardNote}</output>}
                {error && (
                  <div className="chat-action-error" role="alert">
                    <span>{error}</span>
                    <button
                      type="button"
                      aria-label="Dismiss chat error"
                      onClick={() => setError("")}
                    >
                      <X size={15} />
                    </button>
                  </div>
                )}
              </form>
            </>
          )}
        </section>
        <aside className="community-info">
          <div className="community-info-icon">
            <Users size={24} />
          </div>
          <span className="eyebrow">BETTER TOGETHER</span>
          <h2>
            Every collector
            <br />
            has a story.
          </h2>
          <p>
            Found your first Legend? Building an all-hockey roster? This is your place to share it.
          </p>
          <div className="community-sports">
            <span>Basketball</span>
            <span>Soccer</span>
            <span>Football</span>
            <span>Ice hockey</span>
            <span>Baseball</span>
          </div>
          <div className="chat-earn-card">
            <Coins size={20} />
            <strong>Talk sports. Earn coins.</strong>
            <p>
              Get 3 coins for each original message of 5 or more characters. Repeating your recent
              messages won't count, even if you change case, spacing, or punctuation.
            </p>
          </div>
          <div className="community-rules">
            <h3>
              <ShieldCheck size={17} />
              Keep it a good game.
            </h3>
            <ul>
              <li>Be respectful to fellow collectors.</li>
              <li>No spam, scams, or personal information.</li>
              <li>Keep the conversation sports-friendly.</li>
            </ul>
            <small>
              One message every 3 seconds.
              <br />
              Repeat checks cover the last 5 seconds.
              <br />
              You can delete your own messages.
            </small>
          </div>
        </aside>
      </div>
      {deleteId !== null && (
        <Dialog
          className="chat-delete-dialog"
          label="Delete your message"
          close={() => setDeleteId(null)}
          busy={remove.isPending}
        >
          <h2>Delete this message?</h2>
          <p>It will be removed from the shared room for everyone. This can't be undone.</p>
          <div className="chat-delete-actions">
            <button
              className="secondary"
              disabled={remove.isPending}
              onClick={() => setDeleteId(null)}
            >
              Keep message
            </button>
            <button className="primary" disabled={remove.isPending} onClick={deleteMessage}>
              {remove.isPending ? (
                <LoaderCircle className="spin" size={16} />
              ) : (
                <Trash2 size={16} />
              )}
              Delete message
            </button>
          </div>
        </Dialog>
      )}
      {isOwner && moderationOpen && (
        <ModerationPanel close={() => setModerationOpen(false)} initialUserId={moderationTarget} />
      )}
      {isStaff && staffOpen && user && access.data && <StaffPanel userId={user.id} role={access.data.role} close={() => setStaffOpen(false)} />}
    </>
  );
}
