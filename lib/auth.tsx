"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { firebaseAuth, firebaseConfigured } from "./firebase";
import { forgetGoogleSession } from "./google-one-tap";
import type { Usage } from "./usage";

type AuthState = {
  /** False until the Firebase keys are set; the app then runs without accounts. */
  configured: boolean;
  /** True once Firebase has said whether someone is signed in. */
  ready: boolean;
  user: User | null;
  usage: Usage | null;
  refreshUsage: () => Promise<void>;
  setUsage: (u: Usage) => void;
  /** Headers that identify the signed-in account to the API routes. */
  authHeaders: () => Promise<Record<string, string>>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(!firebaseConfigured);
  const [usage, setUsage] = useState<Usage | null>(null);

  useEffect(() => {
    const auth = firebaseAuth();
    if (!auth) return;
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setReady(true);
      if (!u) setUsage(null);
    });
  }, []);

  const authHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const token = await firebaseAuth()?.currentUser?.getIdToken();
    return token ? { "x-id-token": token } : {};
  }, []);

  const refreshUsage = useCallback(async () => {
    if (firebaseConfigured && !firebaseAuth()?.currentUser) return;
    try {
      const res = await fetch("/api/usage", { headers: await authHeaders() });
      if (res.ok) setUsage(await res.json());
    } catch {
      // offline: keep the last known value
    }
  }, [authHeaders]);

  useEffect(() => {
    if (ready && (user || !firebaseConfigured)) void refreshUsage();
  }, [ready, user, refreshUsage]);

  const value = useMemo(
    () => ({ configured: firebaseConfigured, ready, user, usage, refreshUsage, setUsage, authHeaders }),
    [ready, user, usage, refreshUsage, authHeaders],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

// ---------- Actions ----------

function requireAuth() {
  const auth = firebaseAuth();
  if (!auth) throw new Error("Sign-in isn't set up yet. Add the Firebase keys to turn on accounts.");
  return auth;
}

export async function continueWithGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  await signInWithPopup(requireAuth(), provider);
}

export async function logIn(email: string, password: string) {
  await signInWithEmailAndPassword(requireAuth(), email.trim(), password);
}

export async function signUp(name: string, email: string, password: string) {
  const cred = await createUserWithEmailAndPassword(requireAuth(), email.trim(), password);
  if (name.trim()) await updateProfile(cred.user, { displayName: name.trim() });
}

export async function resetPassword(email: string) {
  await sendPasswordResetEmail(requireAuth(), email.trim());
}

export async function logOut() {
  const auth = firebaseAuth();
  if (auth) await signOut(auth);
  forgetGoogleSession();
}

/** Plain-language messages for Firebase Auth errors. */
export function authMessage(err: unknown): string {
  const code = (err as { code?: string })?.code ?? "";
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "That email and password don't match. Check them and try again.";
    case "auth/invalid-email":
      return "Enter a valid email address, like name@example.com.";
    case "auth/email-already-in-use":
      return "There's already an account with this email. Log in instead.";
    case "auth/weak-password":
      return "Choose a password with at least 6 characters.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a minute, then try again.";
    case "auth/network-request-failed":
      return "Couldn't reach the server. Check your connection and try again.";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "";
    case "auth/popup-blocked":
      return "Your browser blocked the Google window. Allow pop-ups for this site, then try again.";
    case "auth/operation-not-allowed":
      return "This sign-in method isn't turned on yet in Firebase.";
    case "auth/unauthorized-domain":
      return "This web address isn't allowed to sign in yet. Add it under Firebase → Authentication → Settings → Authorized domains.";
    default:
      return err instanceof Error ? err.message : "Something went wrong. Try again.";
  }
}
