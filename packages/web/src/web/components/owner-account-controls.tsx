import { useState } from "react";
import { Copy, KeyRound, LoaderCircle, Mail } from "lucide-react";
import { useCreateResetLink } from "../queries/account-management";
import "../styles/account-management.css";

export function OwnerAccountControls({ member }: { member: { id: string; email: string; emailVerified: boolean; hasPassword: boolean } }) {
  const create = useCreateResetLink();
  const [message, setMessage] = useState("");
  const link = create.data ? `${window.location.origin}/reset-password#token=${create.data.token}` : "";
  async function generate() {
    setMessage("");
    try { await create.mutateAsync({ userId: member.id }); } catch { /* shown below */ }
  }
  async function copyLink() {
    try { await navigator.clipboard.writeText(link); setMessage("Reset link copied. Share it privately with this collector."); }
    catch { setMessage("Select the link below and copy it manually."); }
  }
  return <section className="owner-account-controls" aria-label="Owner account details">
    <h4><Mail size={15} />Account details · owner only</h4>
    <div className="owner-email" aria-label="Collector email">{member.email}</div>
    <p>{member.emailVerified ? "Email verified" : "Email not verified"} · {member.hasPassword ? "Email/password sign-in" : "Google sign-in"}</p>
    <p>Passwords are private and cannot be viewed.</p>
    {member.hasPassword ? <>
      <button className="secondary" disabled={create.isPending} onClick={generate}>
        {create.isPending ? <LoaderCircle size={15} className="spin" /> : <KeyRound size={15} />}Generate reset link
      </button>
      <small>Single use · expires in 15 minutes · no email is sent automatically</small>
      {create.data && <div className="owner-reset-link">
        <label htmlFor="owner-reset-link">Share only with this collector</label>
        <input id="owner-reset-link" aria-label="Private password reset link" type="text" readOnly value={link} onFocus={(event) => event.target.select()} />
        <button className="secondary" onClick={copyLink}><Copy size={14} />Copy reset link</button>
        <small>Expires {new Date(create.data.expiresAt).toLocaleTimeString()}. The collector chooses their own new password.</small>
      </div>}
      {create.isError && <p className="error" role="alert">{create.error.message}</p>}
      {message && <output>{message}</output>}
    </> : <small>This account has no Sportlet password. Use Google account recovery instead.</small>}
  </section>;
}