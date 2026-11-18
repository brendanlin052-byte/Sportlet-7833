import { useState } from "react";
import { Shield, X } from "lucide-react";
import { Dialog } from "./dialog";
import { useStaffActions, useStaffMembers } from "../queries/staff";
import "../styles/staff.css";
export function ModeratorBadge() {
  return <span className="moderator-badge"><Shield size={11} />Moderator</span>;
}
export function StaffPanel({ userId, role, close }: { userId: string; role: string; close: () => void }) {
  const members = useStaffMembers(userId);
  const { appoint, remove, reset } = useStaffActions();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState(100);
  const [confirmation, setConfirmation] = useState<"remove" | "reset" | "appoint" | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const selected = members.data?.find((member) => member.id === selectedId);
  const ownOwnerProgress = role === "owner" && selected?.role === "owner" && selected.id === userId;
  const protectedTarget = !selected || (selected.role === "owner" && !ownOwnerProgress) || (role !== "owner" && selected.role === "moderator");
  const validReason = reason.trim().length >= 3 && reason.trim().length <= 200;
  const validAmount = Number.isInteger(amount) && amount > 0 && amount <= 1000000 && amount <= (selected?.coins ?? 0);
  const busy = appoint.isPending || remove.isPending || reset.isPending;
  async function confirm() {
    if (!selected) return;
    setError("");
    try {
      if (confirmation === "appoint") {
        const result = await appoint.mutateAsync({ userId: selected.id, moderator: selected.role !== "moderator" });
        setNotice(`${selected.name} is now a ${result.role}.`);
      } else if (confirmation === "remove") {
        const result = await remove.mutateAsync({ userId: selected.id, amount, reason, confirm: true });
        setNotice(`Removed ${result.removed.toLocaleString()} coins. Balance: ${result.coins.toLocaleString()}.`);
      } else if (confirmation === "reset") {
        const result = await reset.mutateAsync({ userId: selected.id, reason, confirm: true });
        setNotice(`Progress reset to 500 coins. ${result.discardedListings} active listing(s) discarded.`);
      }
      setConfirmation(null); setReason("");
    } catch (e) { setError(e instanceof Error ? e.message : "Action failed. Try again."); }
  }
  function prepare(action: "remove" | "reset" | "appoint") { setError(""); setNotice(""); setConfirmation(action); }
  return <Dialog className="batch-modal staff-modal" label="Manage players" busy={busy} close={close}>
    <header className="staff-head"><div><span className="eyebrow">STAFF PROGRESS TOOLS</span><h2>Manage players.</h2></div><button aria-label="Close staff tools" disabled={busy} onClick={close}><X size={20} /></button></header>
    <div className="staff-body">
      <p className="staff-scope">{role === "owner" ? "Appoint moderators and manage collector progress, including your own. Only you can remove your coins or reset your owner progress." : "Remove coins or reset collector progress. Owner and moderator accounts are protected."} Emails and password controls remain owner-only.</p>
      {members.isLoading ? <p>Loading players…</p> : members.isError ? <div className="inline-error">{members.error.message}<button onClick={() => members.refetch()}>Try again</button></div> : <>
        <label className="staff-search">Find a player<input aria-label="Search players" placeholder="Search by name…" value={search} disabled={!!confirmation} onChange={(e) => setSearch(e.target.value)} /></label>
        <div className="staff-layout"><div className="staff-list">{members.data?.filter((member) => member.name.toLowerCase().includes(search.toLowerCase())).map((member) => <button key={member.id} disabled={!!confirmation || busy} className={selectedId === member.id ? "selected" : ""} onClick={() => { setSelectedId(member.id); setError(""); setNotice(""); setReason(""); }}><b>{member.name}</b><span>{member.role} {member.banned ? "· banned" : ""} · {member.coins.toLocaleString()} coins</span></button>)}
          {!members.data?.some((member) => member.name.toLowerCase().includes(search.toLowerCase())) && <p>No matching players.</p>}</div>
          <div className="staff-detail">{selected ? <><h3>{selected.name}</h3><p className="staff-balance">{selected.coins.toLocaleString()} coins <span>· {selected.role}</span></p>
            {ownOwnerProgress && <p className="staff-protected">You are editing your own owner progress. Your owner role and login will remain unchanged.</p>}
            {protectedTarget ? <p className="staff-protected">This staff account is protected.</p> : <>
              {!confirmation && <><label>Reason <small>Required for progress changes</small><textarea aria-label="Reason for progress change" value={reason} maxLength={200} rows={3} onChange={(e) => setReason(e.target.value)} placeholder="Explain why this action is needed…" /></label>
                <label>Coins to remove<input aria-label="Coins to remove" type="number" min={1} max={Math.min(selected.coins, 1000000)} value={amount} onChange={(e) => setAmount(Number(e.target.value))} /></label>
                <button className="secondary" disabled={busy || !validAmount || !validReason} onClick={() => prepare("remove")}>Remove coins</button>
                <div className="staff-reset"><h4>Reset player progress</h4><p>500 coins, empty collection, zero packs opened and a fresh daily reward. Active bazaar listings are discarded, not returned. Casino chips become 0. Account, clan membership, casino history and chat history stay intact.</p><button className="staff-danger" disabled={busy || !validReason} onClick={() => prepare("reset")}>Reset progress</button></div>
                {role === "owner" && selected.role !== "owner" && <div className="staff-appointment"><h4>Moderator access</h4><p>Moderators can remove coins and reset collectors. Only you can appoint or remove them.</p><button className="secondary" disabled={busy} onClick={() => prepare("appoint")}>{selected.role === "moderator" ? "Remove moderator" : "Appoint moderator"}</button></div>}
              </>}
              {confirmation && <div className="staff-confirm" role="alert"><h4>{confirmation === "appoint" ? `${selected.role === "moderator" ? "Remove" : "Appoint"} moderator?` : confirmation === "remove" ? `Remove ${amount.toLocaleString()} coins?` : "Reset this player's progress?"}</h4>
                <p>Player: <b>{selected.name}</b></p>
                <p>{confirmation === "appoint" ? selected.role === "moderator" ? "Staff progress access will be revoked immediately." : "This player will gain coin-removal and progress-reset access for collectors." : confirmation === "remove" ? `Balance will change from ${selected.coins.toLocaleString()} to ${(selected.coins - amount).toLocaleString()} coins.` : "This cannot be undone. All collected cards and active bazaar listings will be discarded; balance becomes 500 coins, casino chips become 0 and daily rewards restart. Login, role, clan membership, casino history and chat history are kept."}</p>
                {confirmation !== "appoint" && <p>Reason: {reason}</p>}
              </div>}
            </>}
          </> : <div className="empty"><Shield /><h3>Select a player</h3><p>Review their balance before making changes.</p></div>}</div>
        </div>
      </>}
      {notice && <output className="staff-notice">{notice}</output>}{error && <div className="inline-error" role="alert">{error}</div>}
    </div>
    <footer className="staff-foot">{confirmation ? <><button className="secondary" disabled={busy} onClick={() => { setConfirmation(null); setError(""); }}>Go back</button><button className="staff-danger" disabled={busy || protectedTarget} onClick={confirm}>{busy ? "Working…" : confirmation === "appoint" ? "Confirm role change" : confirmation === "remove" ? "Confirm coin removal" : "Confirm progress reset"}</button></> : <><span>Every change is audited.</span><button className="secondary" onClick={close}>Done</button></>}</footer>
  </Dialog>;
}