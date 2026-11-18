import { useState } from "react";
import { X, ArrowRight, LoaderCircle } from "lucide-react";
import { Dialog } from "./dialog";
import { authClient } from "../lib/auth";
export function AuthDialog({ close }: { close: () => void }) {
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    try {
      const credentials = { email: String(fd.get("email")), password: String(fd.get("password")) };
      const res = register
        ? await authClient.signUp.email({ ...credentials, name: String(fd.get("name")) })
        : await authClient.signIn.email(credentials);
      if (res.error) setError(res.error.message ?? "Unable to sign in.");
      else close();
    } catch {
      setError("Connection failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  async function google() {
    setBusy(true);
    setError("");
    try {
      const r = await authClient.managedAuth.signIn({ provider: "google" });
      if (r.error) {
        if (r.error.code !== "POPUP_CLOSED") setError(r.error.message ?? "Google sign-in failed.");
      } else close();
    } catch {
      setError("Google sign-in could not connect. Try email instead.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog className="auth-modal" close={close} label="Account sign in">
      <button className="close" onClick={close} aria-label="Close">
        <X size={20} />
      </button>
      <div className="wordmark">
        Sportlet<span>.</span>
      </div>
      <h2>{register ? "Start your collection." : "Welcome back, collector."}</h2>
      <p>
        {register
          ? "Get 500 starter coins. Find your first favorite."
          : "Your next favorite is waiting for you."}
      </p>
      <div className="auth-tabs">
        <button className={!register ? "active" : ""} onClick={() => setRegister(false)}>
          Sign in
        </button>
        <button className={register ? "active" : ""} onClick={() => setRegister(true)}>
          Create account
        </button>
      </div>
      <button className="google-btn" disabled={busy} onClick={google}>
        <b>G</b> Continue with Google
      </button>
      <div className="divider">or with email</div>
      <form onSubmit={submit}>
        {register && (
          <label>
            Collector name
            <input
              name="name"
              aria-label="Collector name"
              autoComplete="name"
              placeholder="Your nickname"
              required
              maxLength={30}
            />
          </label>
        )}
        <label>
          Email
          <input
            name="email"
            aria-label="Email"
            autoComplete="email"
            type="email"
            placeholder="you@example.com"
            required
          />
        </label>
        <label>
          Password
          <input
            name="password"
            aria-label="Password"
            autoComplete={register ? "new-password" : "current-password"}
            type="password"
            placeholder="At least 8 characters"
            minLength={8}
            required
          />
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="primary" disabled={busy}>
          {busy ? (
            <LoaderCircle className="spin" size={18} />
          ) : (
            <>
              {register ? "Create account" : "Sign in"}
              <ArrowRight size={18} />
            </>
          )}
        </button>
      </form>
      <small>Free to collect. No real-money purchases.</small>
    </Dialog>
  );
}
