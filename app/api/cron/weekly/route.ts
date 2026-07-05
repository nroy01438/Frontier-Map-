import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  runExpeditionPlanner,
  NoActiveExpeditionSlotError,
  NoFrontierCandidateError,
} from "@/lib/expeditionPlanner";

/** PRD 12: weekly cron — plans one new expedition for every eligible, non-paused user. */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const users = await prisma.user.findMany({ where: { expeditionsPaused: false } });
  const results: { userId: string; ok: boolean; skipped?: string }[] = [];

  for (const user of users) {
    try {
      await runExpeditionPlanner(user.id);
      results.push({ userId: user.id, ok: true });
    } catch (e) {
      if (e instanceof NoActiveExpeditionSlotError || e instanceof NoFrontierCandidateError) {
        results.push({ userId: user.id, ok: true, skipped: e.message });
      } else {
        console.error(`Weekly cron failed for user ${user.id}`, e);
        results.push({ userId: user.id, ok: false });
      }
    }
  }

  return NextResponse.json({ results });
}
