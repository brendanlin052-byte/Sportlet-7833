import { useState } from "react";
import { Crown, LockKeyhole, Search, Shield, Trophy, Users, X } from "lucide-react";
import { useClanActions, useClanMessages, useClans, useMyClan } from "../queries/clans";
import { Dialog } from "./dialog";
import "../styles/expansion.css";
function ClanChat({ userId, clanId }: { userId: string; clanId: string }) {
  const messages = useClanMessages(userId, clanId);
  const { send } = useClanActions();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const unique = new Map<
    number,
    NonNullable<typeof messages.data>["pages"][number]["messages"][number]
  >();
  messages.data?.pages
    .filter((page) => page.clanId === clanId)
    .forEach((page) => page.messages.forEach((message) => unique.set(message.id, message)));
  const rows = [...unique.values()].sort((a, b) => a.id - b.id);
  async function submit() {
    setError("");
    try {
      await send.mutateAsync({ body: draft });
      setDraft("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not send message.");
    }
  }
  return (
    <section className="clan-chat">
      <header>
        <LockKeyhole size={20} />
        <div>
          <h2>Clan clubhouse</h2>
          <p>Private to current clan members · refreshes every 3 seconds</p>
        </div>
      </header>
      <div className="clan-chat-feed" role="log" aria-label="Clan messages">
        {messages.isLoading ? (
          <p>Loading clan chat…</p>
        ) : messages.isError ? (
          <div className="inline-error">
            {messages.error.message}
            <button onClick={() => messages.refetch()}>Retry</button>
          </div>
        ) : (
          <>
            {messages.hasNextPage && (
              <button
                className="secondary"
                disabled={messages.isFetchingNextPage}
                onClick={() => messages.fetchNextPage()}
              >
                {messages.isFetchingNextPage ? "Loading…" : "Load earlier messages"}
              </button>
            )}
            {!rows.length && (
              <div className="empty">
                <Shield />
                <h3>Your clan's own corner.</h3>
                <p>Start a conversation with your teammates.</p>
              </div>
            )}
            {rows.map((message) => (
              <article className={message.userId === userId ? "own" : ""} key={message.id}>
                <div>
                  <b>{message.name}</b>
                  <time>
                    {new Date(message.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </div>
                <p>{message.body}</p>
              </article>
            ))}
          </>
        )}
      </div>
      <form
        className="clan-composer"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <textarea
          aria-label="Message your clan"
          placeholder="Talk tactics. Share a pull…"
          rows={2}
          maxLength={500}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button
          className="primary"
          disabled={send.isPending || !draft.trim() || messages.isError || messages.isLoading}
        >
          {send.isPending ? "Sending…" : "Send to clan"}
        </button>
        <small>{draft.length}/500 · 3-second cooldown · no coin rewards</small>
        {error && (
          <div className="inline-error" role="alert">
            {error}
          </div>
        )}
      </form>
    </section>
  );
}
type Confirm = {
  kind: "join" | "leave" | "disband" | "kick" | "transfer";
  userId?: string;
  clanId?: string;
  name: string;
};
export function Clans({
  userId,
  signIn,
  loading,
}: {
  userId?: string;
  signIn: () => void;
  loading: boolean;
}) {
  const directory = useClans();
  const mine = useMyClan(userId);
  const actions = useClanActions();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("mine");
  const [form, setForm] = useState<"create" | "edit" | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [inviteOnly, setInviteOnly] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirm | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const clan = mine.data?.clan;
  const leader = !!clan && clan.leaderId === userId;
  const busy = Object.values(actions).some((action) => action.isPending);
  const ready = !loading && !mine.isLoading;
  async function run(task: () => Promise<unknown>, message: string) {
    setError("");
    try {
      await task();
      setNotice(message);
      setForm(null);
      setConfirmation(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Action failed. Try again.");
    }
  }
  function openForm(kind: "create" | "edit") {
    if (!userId) return signIn();
    setError("");
    setName(kind === "edit" ? (clan?.name ?? "") : "");
    setDescription(kind === "edit" ? (clan?.description ?? "") : "");
    setInviteOnly(kind === "edit" ? (clan?.inviteOnly ?? false) : false);
    setForm(kind);
  }
  function prepare(value: Confirm) {
    if (!userId) return signIn();
    setError("");
    setConfirmation(value);
  }
  async function confirm() {
    if (!confirmation) return;
    const c = confirmation;
    if (c.kind === "join")
      await run(
        () => actions.join.mutateAsync({ clanId: c.clanId! }),
        "Clan joined or request submitted. Check My clan for your status.",
      );
    else if (c.kind === "leave")
      await run(() => actions.leave.mutateAsync({ confirm: true }), "You left the clan.");
    else if (c.kind === "disband")
      await run(() => actions.disband.mutateAsync({ confirm: true }), "Clan disbanded.");
    else
      await run(
        () => actions.manage.mutateAsync({ userId: c.userId!, action: c.kind, confirm: true }),
        c.kind === "kick" ? "Member removed." : "Leadership transferred.",
      );
  }
  return (
    <section className="clans-page">
      <div className="page-title">
        <div>
          <div className="eyebrow">
            <span />
            COLLECT BETTER, TOGETHER
          </div>
          <h1>
            Find your clan<span>.</span>
          </h1>
          <p>A shared clubhouse, a stronger roster and a place on the leaderboard.</p>
        </div>
        {!clan && (
          <button
            className="secondary"
            disabled={!ready || busy}
            onClick={() => openForm("create")}
          >
            <Users size={17} />
            Create clan
          </button>
        )}
      </div>
      <div className="exp-tabs">
        <button className={tab === "mine" ? "active" : ""} onClick={() => setTab("mine")}>
          My clan
        </button>
        <button className={tab === "directory" ? "active" : ""} onClick={() => setTab("directory")}>
          Clans & leaderboard
        </button>
      </div>
      {notice && <output className="exp-notice">{notice}</output>}
      {error && !form && !confirmation && (
        <div className="inline-error" role="alert">
          {error}
        </div>
      )}
      {tab === "mine" &&
        (loading || mine.isLoading ? (
          <div className="empty">Loading your clan…</div>
        ) : mine.isError ? (
          <div className="inline-error">
            {mine.error.message}
            <button onClick={() => mine.refetch()}>Retry</button>
          </div>
        ) : !userId ? (
          <div className="exp-callout">
            <p>Sign in to join a clan and use its private clubhouse.</p>
            <button className="secondary" onClick={signIn}>
              Sign in
            </button>
          </div>
        ) : !clan ? (
          <div className="clan-welcome">
            <Users size={38} />
            <h2>Your team is out there.</h2>
            <p>
              Join an open clan or request a spot in an invite-only clan. One clan per collector; up
              to 50 members.
            </p>
            {mine.data?.pending && (
              <div className="exp-callout">
                <p>
                  Request pending: <b>{mine.data.pending.name}</b>
                </p>
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() =>
                    run(() => actions.cancel.mutateAsync(undefined), "Join request cancelled.")
                  }
                >
                  Cancel request
                </button>
              </div>
            )}
            <button className="primary" onClick={() => setTab("directory")}>
              Explore clans
            </button>
          </div>
        ) : (
          <>
            <div className="clan-banner">
              <div className="exp-icon">
                <Shield size={32} />
              </div>
              <div>
                <span>{clan.inviteOnly ? "INVITE-ONLY CLAN" : "OPEN CLAN"}</span>
                <h2>{clan.name}</h2>
                <p>{clan.description || "A clan for collectors who love the game."}</p>
              </div>
              <div className="clan-banner-count">
                <strong>{mine.data?.members.length}/50</strong>
                <span>MEMBERS</span>
              </div>
            </div>
            <div className="clan-layout">
              <ClanChat key={clan.id} userId={userId} clanId={clan.id} />
              <aside className="clan-roster">
                <h2>Your teammates</h2>
                {mine.data?.members.map((member) => (
                  <article key={member.id}>
                    <div>
                      <b>{member.name}</b>
                      <small>
                        {member.id === clan.leaderId ? "Clan leader" : "Member"}
                        {member.id === userId ? " · You" : ""}
                      </small>
                    </div>
                    {member.id === clan.leaderId && <Crown size={16} />}
                    {leader && member.id !== userId && (
                      <div className="clan-member-actions">
                        <button
                          disabled={busy}
                          aria-label={`Remove ${member.name} from clan`}
                          onClick={() =>
                            prepare({ kind: "kick", userId: member.id, name: member.name })
                          }
                        >
                          Remove
                        </button>
                        <button
                          disabled={busy}
                          aria-label={`Make ${member.name} clan leader`}
                          onClick={() =>
                            prepare({ kind: "transfer", userId: member.id, name: member.name })
                          }
                        >
                          Make leader
                        </button>
                      </div>
                    )}
                  </article>
                ))}
                {leader ? (
                  <>
                    <div className="clan-requests">
                      <h3>Join requests</h3>
                      {!mine.data?.requests.length && <p>No pending requests.</p>}
                      {mine.data?.requests.map((request) => (
                        <article key={request.id}>
                          <b>{request.name}</b>
                          <div className="clan-member-actions">
                            <button
                              disabled={busy}
                              aria-label={`Accept ${request.name}`}
                              onClick={() =>
                                run(
                                  () =>
                                    actions.decide.mutateAsync({
                                      userId: request.id,
                                      accept: true,
                                    }),
                                  "Member accepted.",
                                )
                              }
                            >
                              Accept
                            </button>
                            <button
                              disabled={busy}
                              aria-label={`Decline ${request.name}`}
                              onClick={() =>
                                run(
                                  () =>
                                    actions.decide.mutateAsync({
                                      userId: request.id,
                                      accept: false,
                                    }),
                                  "Request declined.",
                                )
                              }
                            >
                              Decline
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                    <button className="secondary" disabled={busy} onClick={() => openForm("edit")}>
                      Edit clan
                    </button>
                    <button
                      className="exp-danger"
                      disabled={busy}
                      onClick={() => prepare({ kind: "disband", name: clan.name })}
                    >
                      Disband clan
                    </button>
                    <small>Transfer leadership to another member before leaving.</small>
                  </>
                ) : (
                  <button
                    className="exp-danger"
                    disabled={busy}
                    onClick={() => prepare({ kind: "leave", name: clan.name })}
                  >
                    Leave clan
                  </button>
                )}
              </aside>
            </div>
          </>
        ))}
      {tab === "directory" && (
        <>
          <div className="clan-directory-heading">
            <div>
              <Trophy size={20} />
              <p>
                Score = sum of each member's unique-card ratings. Duplicates do not add points.
                Active bazaar cards count; banned players do not.
              </p>
            </div>
            <label className="search-box">
              <Search size={16} />
              <input
                aria-label="Search clans"
                placeholder="Find a clan…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
          </div>
          {directory.isLoading ? (
            <div className="empty">Loading clans…</div>
          ) : directory.isError ? (
            <div className="inline-error">
              {directory.error.message}
              <button onClick={() => directory.refetch()}>Retry</button>
            </div>
          ) : (
            <div className="clan-directory">
              {directory.data
                ?.map((entry, index) => ({ ...entry, rank: index + 1 }))
                .filter((entry) => entry.name.toLowerCase().includes(search.toLowerCase()))
                .map((entry) => (
                  <article key={entry.id}>
                    <span className="clan-rank">#{entry.rank}</span>
                    <div>
                      <h3>
                        {entry.name} {entry.inviteOnly && <LockKeyhole size={14} />}
                      </h3>
                      <p>{entry.description || "No description yet."}</p>
                      <small>
                        {entry.members}/50 members · Led by {entry.leaderName} ·{" "}
                        {entry.inviteOnly ? "Join requests" : "Open membership"}
                      </small>
                    </div>
                    <div className="clan-score">
                      <b>{entry.score.toLocaleString()}</b>
                      <span>POINTS</span>
                      <button
                        className="secondary"
                        disabled={
                          busy ||
                          !ready ||
                          !!clan ||
                          entry.members >= 50 ||
                          mine.data?.pending?.clanId === entry.id
                        }
                        onClick={() =>
                          prepare({ kind: "join", clanId: entry.id, name: entry.name })
                        }
                      >
                        {clan?.id === entry.id
                          ? "Your clan"
                          : mine.data?.pending?.clanId === entry.id
                            ? "Requested"
                            : entry.members >= 50
                              ? "Full"
                              : entry.inviteOnly
                                ? "Request to join"
                                : "Join clan"}
                      </button>
                    </div>
                  </article>
                ))}
              {!directory.data?.some((entry) =>
                entry.name.toLowerCase().includes(search.toLowerCase()),
              ) && (
                <div className="empty">
                  <Users />
                  <h3>No matching clans</h3>
                  <p>Create a clan or try another name.</p>
                </div>
              )}
            </div>
          )}
        </>
      )}
      {(form || confirmation) && (
        <Dialog
          label={form ? "Clan details" : "Confirm clan action"}
          className="batch-modal exp-modal"
          busy={busy}
          close={() => {
            setForm(null);
            setConfirmation(null);
          }}
        >
          <header>
            <h2>
              {form
                ? form === "create"
                  ? "Start your clan."
                  : "Edit your clan."
                : confirmation?.kind === "join"
                  ? "Join this clan?"
                  : confirmation?.kind === "transfer"
                    ? "Transfer leadership?"
                    : confirmation?.kind === "kick"
                      ? "Remove this member?"
                      : confirmation?.kind === "leave"
                        ? "Leave your clan?"
                        : "Disband your clan?"}
            </h2>
            <button
              aria-label="Close clan dialog"
              disabled={busy}
              onClick={() => {
                setForm(null);
                setConfirmation(null);
              }}
            >
              <X size={20} />
            </button>
          </header>
          <div className="exp-modal-body">
            {form ? (
              <>
                <label>
                  Clan name
                  <input
                    aria-label="Clan name"
                    value={name}
                    maxLength={32}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <label>
                  Description
                  <textarea
                    aria-label="Clan description"
                    rows={3}
                    maxLength={240}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </label>
                <label className="exp-check">
                  <input
                    type="checkbox"
                    aria-label="Invite-only clan"
                    checked={inviteOnly}
                    onChange={(e) => setInviteOnly(e.target.checked)}
                  />
                  Invite-only: the leader approves join requests
                </label>
                <p>
                  Free to create. One clan per collector, up to 50 members. Your existing cards and
                  coins stay yours.
                </p>
              </>
            ) : (
              <>
                <h3>{confirmation?.name}</h3>
                <p>
                  {confirmation?.kind === "join"
                    ? "Open clans are joined immediately. Invite-only clans require leader approval. Joining replaces any other pending request."
                    : confirmation?.kind === "transfer"
                      ? "You will become a regular member. The new leader can manage members and disband the clan."
                      : confirmation?.kind === "kick"
                        ? "This member loses access to the private clan chat. Their cards and coins are not affected."
                        : confirmation?.kind === "leave"
                          ? "You will lose access to the clan's private chat. Your cards and coins stay intact."
                          : "This permanently removes the clan, its join requests and its private chat history. All members will leave. Personal cards and coins stay intact."}
                </p>
              </>
            )}
            {error && (
              <div className="inline-error" role="alert">
                {error}
              </div>
            )}
          </div>
          <footer>
            <button
              className="secondary"
              disabled={busy}
              onClick={() => {
                setForm(null);
                setConfirmation(null);
              }}
            >
              Go back
            </button>
            <button
              className="primary"
              disabled={busy || (!!form && (name.trim().length < 3 || name.trim().length > 32))}
              onClick={() =>
                form
                  ? run(
                      () =>
                        form === "create"
                          ? actions.create.mutateAsync({ name, description, inviteOnly })
                          : actions.edit.mutateAsync({ name, description, inviteOnly }),
                      form === "create" ? "Clan created." : "Clan updated.",
                    )
                  : confirm()
              }
            >
              {busy ? "Working…" : form ? "Save clan" : "Confirm action"}
            </button>
          </footer>
        </Dialog>
      )}
    </section>
  );
}
