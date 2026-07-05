import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ingestUserData } from "@/lib/ingestion";
import { recomputeTerritories } from "@/lib/territoryEngine";
import { pollAndResolveActiveExpeditions } from "@/lib/decisionPolicy";

/** PRD 12: daily cron — ingestion + engagement polling/decision policy for every user. */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const users = await prisma.user.findMany();
  const results: { userId: string; ok: boolean }[] = [];

  for (const user of users) {
    try {
      await ingestUserData(user.id);
      await recomputeTerritories(user.id);
      await pollAndResolveActiveExpeditions(user.id);
      results.push({ userId: user.id, ok: true });
    } catch (e) {
      console.error(`Daily cron failed for user ${user.id}`, e);
      results.push({ userId: user.id, ok: false });
    }
  }

  return NextResponse.json({ results });
}
