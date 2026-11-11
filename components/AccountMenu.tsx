"use client";

import { useEffect, useRef, useState } from "react";
import { logOut, useAuth } from "@/lib/auth";
import { usageLine } from "@/lib/usage";

// Signed-in header control: an initial avatar that opens a small menu with usage and Log out.
export default function AccountMenu() {
  const { user, usage } = useAuth();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!user) return null;
  const label = user.displayName || user.email || "Account";
  const initial = label.trim().charAt(0).toUpperCase();

  return (
    <div className="account" ref={root}>
      {usage && <span className="account-usage">{usageLine(usage)}</span>}
      <button
        ref={button}
        className="avatar"
        aria-label={`Account: ${label}`}
        aria-expanded={open}
        aria-controls="account-menu"
        onClick={() => setOpen((o) => !o)}
      >
        {user.photoURL ? <img src={user.photoURL} alt="" referrerPolicy="no-referrer" /> : initial}
      </button>
      {open && (
        <div className="account-menu" id="account-menu">
          <p className="account-name">{user.displayName || "Signed in"}</p>
          {user.email && <p className="account-email">{user.email}</p>}
          {usage && <p className="account-meta">{usageLine(usage)}</p>}
          <button className="account-logout" onClick={() => void logOut().then(() => setOpen(false))}>
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
