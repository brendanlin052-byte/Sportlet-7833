import { useState } from "react";
import { Crown, LoaderCircle, Shield, X } from "lucide-react";
import { OwnerAccountControls } from "./owner-account-controls";
import { Dialog } from "./dialog";
import { useModerationActions, useModerationMembers } from "../queries/moderation";
export function OwnerBadge() {
  return (
    <span className="owner-badge">
      <Crown size={11} />
      Owner
    </span>
  );
}
export function ModerationPanel({
  close,
  initialUserId,
}: {
  close: () => void;
  initialUserId?: string;
}) {
  const members = useModerationMembers(true);
  const { mute, ban, giveCoins } = useModerationActions();
  const [selectedId, setSelectedId] = useState(initialUserId ?? "");
  const [amount, setAmount] = useState("100");
  const [search, setSearch] = useState("");
  const [reason, setReason] = useState("");
  const [duration, setDuration] = useState<600000 | 3600000 | 86400000>(600000);
  const [pendingBan, setPendingBan] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const busy = mute.isPending || ban.isPending || giveCoins.isPending;
  const selected = members.data?.find((member) => member.id === selectedId);
  async function grantCoins() {
    if (!selected) return;
    setError("");
    setNotice("");
    try {
      const result = await giveCoins.mutateAsync({ userId: selected.id, amount: Number(amount), reason });
      setNotice(`Gave ${result.amount.toLocaleString()} coins to ${selected.name}. Balance: ${result.coins.toLocaleString()} coins.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't give coins.");
    }
  }
  async function muteCollector(unmute = false) {
    if (!selected) return;
    setError("");
    try {
      await mute.mutateAsync({ userId: selected.id, duration: unmute ? 0 : duration, reason });
      setNotice(
        unmute ? "Collector unmuted." : "Collector muted. Chat is blocked until the mute expires.",
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't update this collector.");
    }
  }
  async function banCollector(banned: boolean) {
    if (!selected) return;
    setError("");
    try {
      await ban.mutateAsync({ userId: selected.id, banned, reason });
      setPendingBan(false);
      setNotice(banned ? "Collector banned from all account features." : "Ban removed.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't update this collector.");
    }
  }
  return (
    <Dialog className="moderation-dialog" label="Owner moderation" close={close} busy={busy}>
      <button className="close" aria-label="Close moderation" disabled={busy} onClick={close}>
        <X size={18} />
      </button>
      <div className="eyebrow">
        <Shield size={15} />
        OWNER TOOLS
      </div>
      <h2>Keep it a good game.</h2>
      <p>Give coins, mute chat temporarily or manage account access.</p>
      {members.isLoading ? (
        <div className="chat-loading">
          <LoaderCircle size={24} className="spin" />
          Loading collectors…
        </div>
      ) : members.isError ? (
        <div className="error" role="alert">
          Couldn't load collectors.
          <button className="secondary" onClick={() => members.refetch()}>
            Retry
          </button>
        </div>
      ) : (
        <div className="moderation-grid">
          <div className="moderation-directory">
            <input
              aria-label="Find collector"
              placeholder="Find a name or email…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <div className="moderation-members">
              {members.data
                ?.filter((member) => `${member.name} ${member.email}`.toLowerCase().includes(search.toLowerCase()))
                .map((member) => (
                  <button
                    key={member.id}
                    disabled={busy}
                    className={selectedId === member.id ? "selected" : ""}
                    onClick={() => {
                      setSelectedId(member.id);
                      setPendingBan(false);
                      setReason("");
                      setNotice("");
                      setError("");
                    }}
                  >
                    <strong>{member.name}</strong>
                    <span>
                      {member.role === "owner"
                        ? "Owner · protected"
                        : member.banned
                          ? "Banned"
                          : member.mutedUntil > Date.now()
                            ? "Muted"
                            : "Collector"}
                    </span>
                  </button>
                ))}
            </div>
          </div>
          <div className="moderation-detail">
            {selected ? (
              <>
                <h3>{selected.name}</h3>
                <p className="member-status">
                  {selected.banned
                    ? "Account banned"
                    : selected.mutedUntil > Date.now()
                      ? `Muted until ${new Date(selected.mutedUntil).toLocaleString()}`
                      : "No active restrictions"}
                </p>
                <OwnerAccountControls key={selected.id} member={selected} />
                <label>
                  Reason (optional)
                  <textarea
                    aria-label="Moderation reason"
                    maxLength={200}
                    rows={2}
                    placeholder="Tell the collector why…"
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                  />
                </label>
                <form className="coin-grant" onSubmit={(event) => { event.preventDefault(); void grantCoins(); }}>
                  <label>
                    Give coins · balance {selected.coins.toLocaleString()}
                    <input aria-label="Coins to give" type="number" min={1} max={100000} step={1} required
                      value={amount} disabled={busy} onChange={(event) => setAmount(event.target.value)} />
                  </label>
                  <button className="primary" type="submit" disabled={busy}>
                    {giveCoins.isPending ? "Giving…" : "Give coins"}
                  </button>
                  <small>1–100,000 coins per grant. Grants are recorded.</small>
                </form>
                {selected.role !== "owner" ? (<>
                <label>
                  Mute duration
                  <select
                    aria-label="Mute duration"
                    value={duration}
                    onChange={(event) => setDuration(Number(event.target.value) as typeof duration)}
                  >
                    <option value={600000}>10 minutes</option>
                    <option value={3600000}>1 hour</option>
                    <option value={86400000}>24 hours</option>
                  </select>
                </label>
                <div className="moderation-buttons">
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() => muteCollector(false)}
                  >
                    {mute.isPending ? "Updating…" : "Mute chat"}
                  </button>
                  {selected.mutedUntil > Date.now() && (
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={() => muteCollector(true)}
                    >
                      Unmute
                    </button>
                  )}
                </div>
                {pendingBan ? (
                  <div className="ban-confirm">
                    <p>
                      Ban <b>{selected.name}</b> from packs, rewards, collection APIs, and chat?
                    </p>
                    <button
                      className="danger-button"
                      disabled={busy}
                      onClick={() => banCollector(true)}
                    >
                      {ban.isPending ? "Banning…" : "Confirm ban"}
                    </button>
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={() => setPendingBan(false)}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    className="danger-button"
                    disabled={busy}
                    onClick={() => (selected.banned ? banCollector(false) : setPendingBan(true))}
                  >
                    {selected.banned ? "Remove ban" : "Ban account"}
                  </button>
                )}
                </>) : <p className="member-status">Owner accounts can receive coins, but cannot be muted or banned.</p>}
              </>
            ) : (
              <div className="moderation-placeholder">
                <Shield size={26} />
                <p>
                  Select an account to give coins or manage access. The owner cannot be muted or banned.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
      {notice && <output className="chat-reward-result">{notice}</output>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </Dialog>
  );
}
