"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type RefObject } from "react";
import { authMessage, continueWithGoogle, useAuth } from "@/lib/auth";
import { FREE_GENERATIONS } from "@/lib/usage";

type Props = {
  open: boolean;
  /** True when the person asked for the prompt (the Sign in button): focus moves into it and back on close. */
  takeFocus: boolean;
  /** Where focus goes back to when a focused prompt closes. */
  returnFocusTo: RefObject<HTMLElement | null>;
  onClose: () => void;
};

// Top-right Google sign-in card (a One Tap–style prompt). It's non-modal: the page stays usable
// behind it. Google signs in right here; email sign-in lives on /login.
export default function SignInPrompt({ open, takeFocus, returnFocusTo, onClose }: Props) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const { configured } = useAuth();
  const googleBtn = useRef<HTMLButtonElement>(null);
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) {
      setNote("");
      return;
    }
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !takeFocus) return;
    googleBtn.current?.focus();
    return () => {
      // Return focus to the Sign in button if focus was inside the prompt (or was dropped
      // to <body> when the closing prompt became inert).
      const active = document.activeElement;
      if (!active || active === document.body || root.current?.contains(active)) returnFocusTo.current?.focus();
    };
  }, [open, takeFocus, returnFocusTo]);

  return (
    <aside ref={root} className={`signin ${open ? "open" : ""}`} aria-labelledby="signin-title" aria-hidden={!open} inert={!open}>
      <div className="signin-head">
        <h2 id="signin-title">Sign in to InstaCaps</h2>
        <button className="signin-close" onClick={onClose} aria-label="Close sign-in">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <p>Log in to generate captions. Every account gets {FREE_GENERATIONS} free generations.</p>
      <button
        ref={googleBtn}
        className="google-btn"
        disabled={busy}
        onClick={async () => {
          if (!configured) {
            setNote("Accounts aren't switched on yet. Add the Firebase keys to enable sign-in.");
            return;
          }
          setNote("");
          setBusy(true);
          try {
            await continueWithGoogle();
            onClose();
          } catch (e) {
            setNote(authMessage(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <GoogleMark />
        {busy ? "Opening Google…" : "Continue with Google"}
      </button>
      <Link href="/login" className="signin-alt">
        Use email instead
      </Link>
      <p className="signin-note" role="status">
        {note}
      </p>
    </aside>
  );
}

export function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}
