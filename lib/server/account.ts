import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { FREE_GENERATIONS, type Usage } from "@/lib/usage";
import { adminAuth, adminConfigured, adminDb } from "./firebase-admin";

export type Account = { uid: string; email: string | null; dev?: boolean };

const DEV: Account = { uid: "dev", email: null, dev: true };

/**
 * Who is calling. The browser sends its Firebase ID token in `x-id-token` (not `Authorization`,
 * which the optional APP_PASSWORD gate in proxy.ts uses). Returns a Response to send back when
 * the caller isn't allowed in.
 */
export async function requireAccount(req: Request): Promise<Account | Response> {
  if (!adminConfigured) {
    // Without server keys, local development runs without accounts. Production refuses rather
    // than spending the Gemini quota with no limit.
    if (process.env.NODE_ENV !== "production") return DEV;
    return Response.json({ error: "Accounts aren't set up on this server yet.", code: "not-configured" }, { status: 503 });
  }
  const token = req.headers.get("x-id-token");
  if (!token) return Response.json({ error: "Log in to generate captions.", code: "signed-out" }, { status: 401 });
  try {
    const decoded = await adminAuth().verifyIdToken(token);
    return { uid: decoded.uid, email: decoded.email ?? null };
  } catch {
    return Response.json({ error: "Your session expired. Log in again.", code: "signed-out" }, { status: 401 });
  }
}

const userDoc = (uid: string) => adminDb().collection("users").doc(uid);

export async function getUsage(account: Account): Promise<Usage> {
  if (account.dev) return { used: 0, limit: FREE_GENERATIONS, enforced: false };
  const snap = await userDoc(account.uid).get();
  const d = snap.data();
  return { used: d?.generationsUsed ?? 0, limit: d?.generationsLimit ?? FREE_GENERATIONS, enforced: true };
}

/**
 * Takes one generation from the account's allowance, atomically, before Gemini is called.
 * Returns null when the allowance is used up. Call refundGeneration if the generation fails.
 */
export async function reserveGeneration(account: Account): Promise<Usage | null> {
  if (account.dev) return { used: 0, limit: FREE_GENERATIONS, enforced: false };
  const ref = userDoc(account.uid);
  return adminDb().runTransaction(async (tx) => {
    const d = (await tx.get(ref)).data();
    const used: number = d?.generationsUsed ?? 0;
    const limit: number = d?.generationsLimit ?? FREE_GENERATIONS;
    if (used >= limit) return null;
    tx.set(
      ref,
      {
        email: account.email,
        generationsUsed: used + 1,
        generationsLimit: limit,
        ...(d ? {} : { createdAt: FieldValue.serverTimestamp() }),
        lastGenerationAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    return { used: used + 1, limit, enforced: true };
  });
}

/** Gives a generation back when the transcription failed, so errors don't cost the user. */
export async function refundGeneration(account: Account) {
  if (account.dev) return;
  const ref = userDoc(account.uid);
  await adminDb()
    .runTransaction(async (tx) => {
      const used: number = (await tx.get(ref)).data()?.generationsUsed ?? 0;
      if (used > 0) tx.update(ref, { generationsUsed: used - 1 });
    })
    .catch(() => {});
}
