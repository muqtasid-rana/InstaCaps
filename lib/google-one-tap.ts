"use client";

import { GoogleAuthProvider, signInWithCredential } from "firebase/auth";
import { firebaseAuth } from "./firebase";

// Google's own sign-in prompt ("One Tap"). In Chrome it's drawn by the browser (FedCM): top right
// on desktop, a bottom sheet on phones, showing the visitor's Google account. The ID token it
// returns signs them in to Firebase. Needs NEXT_PUBLIC_GOOGLE_CLIENT_ID: the Google provider's
// web client ID (Firebase → Authentication → Sign-in method → Google → Web SDK configuration).

export const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

type Moment = { isSkippedMoment?: () => boolean; isNotDisplayed?: () => boolean };
type GoogleId = {
  initialize: (o: Record<string, unknown>) => void;
  prompt: (cb?: (m: Moment) => void) => void;
  cancel: () => void;
  disableAutoSelect: () => void;
};
declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleId } };
  }
}

let loading: Promise<GoogleId> | null = null;

function loadGis(): Promise<GoogleId> {
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id);
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = () => (window.google?.accounts?.id ? resolve(window.google.accounts.id) : reject(new Error("Google sign-in unavailable")));
    s.onerror = () => {
      loading = null;
      reject(new Error("Couldn't load Google sign-in"));
    };
    document.head.appendChild(s);
  });
  return loading;
}

let initialized = false;

/**
 * Shows Google's prompt. `onUnavailable` runs when Google can't show it (no Google session in this
 * browser, the visitor closed it recently, the site isn't an authorized origin, or the script failed),
 * so the page can fall back to its own sign-in card. Returns a function that closes the prompt.
 */
export function showGoogleOneTap({ onUnavailable, onError }: { onUnavailable: () => void; onError: (e: unknown) => void }) {
  if (!googleClientId || !firebaseAuth()) {
    onUnavailable();
    return () => {};
  }
  let cancelled = false;
  loadGis()
    .then((id) => {
      if (cancelled) return;
      if (!initialized) {
        id.initialize({
          client_id: googleClientId,
          callback: ({ credential }: { credential: string }) => {
            signInWithCredential(firebaseAuth()!, GoogleAuthProvider.credential(credential)).catch(onError);
          },
          auto_select: false,
          cancel_on_tap_outside: false,
          context: "signin",
          itp_support: true,
          use_fedcm_for_prompt: true,
        });
        initialized = true;
      }
      id.prompt((m) => {
        // Chrome (FedCM) reports "skipped" both when there's no Google account to show and when the
        // visitor closes the prompt, after a deliberate delay, so the two can't be told apart.
        // Either way, offer the built-in card, which also has the email option.
        // Browsers without FedCM report "not displayed" instead.
        if (!cancelled && (m.isSkippedMoment?.() || m.isNotDisplayed?.())) onUnavailable();
      });
    })
    .catch(() => !cancelled && onUnavailable());
  return () => {
    cancelled = true;
    window.google?.accounts?.id?.cancel();
  };
}

/** After logging out, stop Google from signing the visitor straight back in. */
export function forgetGoogleSession() {
  window.google?.accounts?.id?.disableAutoSelect();
}
