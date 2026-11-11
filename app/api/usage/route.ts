import { getUsage, requireAccount } from "@/lib/server/account";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** How many caption generations the signed-in account has used and has in total. */
export async function GET(req: Request) {
  const account = await requireAccount(req);
  if (account instanceof Response) return account;
  try {
    return Response.json(await getUsage(account));
  } catch (err) {
    console.error("[usage] lookup failed:", err instanceof Error ? err.message : err);
    return Response.json({ error: "Couldn't load your usage. Try again." }, { status: 502 });
  }
}
