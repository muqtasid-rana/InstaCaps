"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import CaptionScene from "@/components/CaptionScene";
import { GoogleMark } from "@/components/SignInPrompt";
import Wordmark from "@/components/Wordmark";
import { authMessage, continueWithGoogle, logIn, resetPassword, signUp, useAuth } from "@/lib/auth";
import { FREE_GENERATIONS } from "@/lib/usage";

type Mode = "login" | "signup";

const COPY = {
  login: {
    title: "Welcome back",
    lede: "Log in to keep captioning your clips.",
    submit: "Log in",
    busy: "Logging in…",
    switchText: "New to InstaCaps?",
    switchLink: "Create an account",
    switchHref: "/signup",
  },
  signup: {
    title: "Create your account",
    lede: `Your first ${FREE_GENERATIONS} caption generations are free. No card needed.`,
    submit: "Create account",
    busy: "Creating account…",
    switchText: "Already have an account?",
    switchLink: "Log in",
    switchHref: "/login",
  },
} as const;

export default function AuthScreen({ mode }: { mode: Mode }) {
  const c = COPY[mode];
  const router = useRouter();
  const params = useSearchParams();
  const { configured, ready, user } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState<"form" | "google" | null>(null);

  // Only same-site paths are allowed as a return address.
  const next = params.get("next")?.startsWith("/") && !params.get("next")?.startsWith("//") ? params.get("next")! : "/";

  useEffect(() => {
    if (ready && user) router.replace(next);
  }, [ready, user, next, router]);

  async function run(kind: "form" | "google", fn: () => Promise<void>) {
    setError("");
    setStatus("");
    setBusy(kind);
    try {
      await fn();
    } catch (e) {
      setError(authMessage(e));
    } finally {
      setBusy(null);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    // Say exactly what's missing before asking Firebase.
    if (!email.trim()) return setError("Enter your email address.");
    if (!password) return setError(mode === "login" ? "Enter your password." : "Choose a password with at least 6 characters.");
    void run("form", () => (mode === "login" ? logIn(email, password) : signUp(name, email, password)));
  }

  function forgot() {
    if (!email.trim()) {
      setError("Enter your email above, then choose Forgot password again.");
      return;
    }
    void run("form", async () => {
      await resetPassword(email);
      setStatus(`If there's an account for ${email.trim()}, a reset link is on its way.`);
    });
  }

  return (
    <main className="site auth">
      <section className="auth-side">
        <header className="auth-bar">
          <Link href="/" className="auth-home" aria-label="InstaCaps home">
            <Wordmark />
          </Link>
        </header>

        <div className="auth-body">
          <h1>{c.title}</h1>
          <p className="auth-lede">{c.lede}</p>

          {!configured && (
            <p className="auth-setup" role="status">
              Accounts aren&apos;t switched on yet. Add the Firebase keys to <code>.env.local</code> to enable sign-in.
            </p>
          )}

          <button className="google-btn auth-google" disabled={!!busy} onClick={() => void run("google", continueWithGoogle)}>
            <GoogleMark />
            {busy === "google" ? "Opening Google…" : "Continue with Google"}
          </button>

          <div className="auth-or">
            <span>or</span>
          </div>

          <form onSubmit={submit} noValidate>
            {mode === "signup" && (
              <div className="field">
                <label htmlFor="auth-name">Name</label>
                <input id="auth-name" name="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
            )}
            <div className="field">
              <label htmlFor="auth-email">Email</label>
              <input
                id="auth-email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-describedby={error ? "auth-error" : undefined}
              />
            </div>
            <div className="field">
              <label htmlFor="auth-password">Password</label>
              <input
                id="auth-password"
                name="password"
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-describedby={mode === "signup" ? "auth-pw-hint" : error ? "auth-error" : undefined}
              />
              {mode === "signup" ? (
                <p id="auth-pw-hint" className="field-hint">
                  At least 6 characters
                </p>
              ) : (
                <button type="button" className="link-btn forgot" onClick={forgot} disabled={!!busy}>
                  Forgot password?
                </button>
              )}
            </div>

            {error && (
              <p id="auth-error" className="auth-error" role="alert">
                {error}
              </p>
            )}
            {status && (
              <p className="auth-status" role="status">
                {status}
              </p>
            )}

            <button type="submit" className="auth-submit" disabled={!!busy}>
              {busy === "form" ? c.busy : c.submit}
            </button>
          </form>

          <p className="auth-switch">
            {c.switchText}{" "}
            <Link href={next === "/" ? c.switchHref : `${c.switchHref}?next=${encodeURIComponent(next)}`}>{c.switchLink}</Link>
          </p>
        </div>
      </section>

      <aside className="auth-visual">
        <CaptionScene />
      </aside>
    </main>
  );
}
