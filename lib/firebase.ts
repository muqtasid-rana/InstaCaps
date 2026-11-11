"use client";

import { getApps, initializeApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

// Public web config (safe to ship to the browser). Next.js only inlines NEXT_PUBLIC_* vars
// when they're referenced literally, so each one is spelled out.
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/** False until the Firebase keys are added. The app then runs without accounts (local dev). */
export const firebaseConfigured = Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);

let cached: Auth | null = null;

export function firebaseAuth(): Auth | null {
  if (!firebaseConfigured) return null;
  if (!cached) cached = getAuth(getApps()[0] ?? initializeApp(config));
  return cached;
}
