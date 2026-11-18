import { useEffect, useState, type FormEvent } from "react";
import { Link } from "wouter";
import { Check, KeyRound, LoaderCircle } from "lucide-react";
import { useResetPassword } from "../queries/account-management";
import "../styles/account-management.css";

export default function ResetPassword() {
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get("token") ?? "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const reset = useResetPassword();
  useEffect(() => {
    window.history.replaceState(null, "", window.location.pathname);
  }, []);
  async function submit(event: FormEvent) {
    event.preventDefault(); setError("");
    if (password !== confirm) return setError("The passwords don't match.");
    try {
      await reset.mutateAsync({ token, newPassword: password });
      setPassword(""); setConfirm("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Couldn't reset your password."); }
  }
  return <div className="reset-page"><section className="reset-panel">
    <Link href="/" className="wordmark">Sportlet<span>.</span></Link>
    {reset.isSuccess ? <>
      <Check size={36} className="reset-symbol" /><h1>Password updated.</h1>
      <p>Your old sessions have been signed out. Sign in with your new password. Your coins and collection are unchanged.</p>
      <Link href="/profile" className="primary">Back to sign in</Link>
    </> : !/^[a-f0-9]{64}$/.test(token) ? <>
      <KeyRound size={36} className="reset-symbol" /><h1>Reset link needed.</h1>
      <p>Ask the owner for a new reset link. Links expire after 15 minutes and work only once.</p>
      <Link href="/" className="primary">Back to Sportlet</Link>
    </> : <>
      <KeyRound size={36} className="reset-symbol" /><h1>A fresh start.</h1>
      <p>Choose a new password. Never share it with the owner or other collectors.</p>
      <form onSubmit={submit}>
        <label>New password<input type="password" aria-label="New password" autoComplete="new-password" minLength={8} maxLength={128} required
          value={password} disabled={reset.isPending} onChange={(event) => setPassword(event.target.value)} /></label>
        <label>Confirm new password<input type="password" aria-label="Confirm new password" autoComplete="new-password" minLength={8} maxLength={128} required
          value={confirm} disabled={reset.isPending} onChange={(event) => setConfirm(event.target.value)} /></label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="primary" disabled={reset.isPending}>{reset.isPending ? <><LoaderCircle className="spin" size={18} />Updating…</> : "Set new password"}</button>
      </form>
      <small>This signs out existing sessions without changing your collection.</small>
    </>}
  </section></div>;
}