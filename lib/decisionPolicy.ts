import { prisma } from "@/lib/prisma";
import { measureExpeditionEngagement, EngagementResult } from "@/lib/engagement";
import { generateRationale } from "@/lib/llm";
import type { Expedition } from "@prisma/client";

const MIN_PLAYED_TRACKS = 3;
const FORCE_CLOSE_DAYS = 14;

type Decision = "claimed" | "retreated" | "inconclusive";

/** PRD 6.6: claim/retreat decision policy, run after each engagement poll. */
export async function resolveExpedition(userId: string, expedition: Expedition): Promise<Decision | "pending"> {
  const engagement = await measureExpeditionEngagement(userId, expedition);
  const ageMs = Date.now() - expedition.createdAt.getTime();
  const forceClose = ageMs >= FORCE_CLOSE_DAYS * 24 * 60 * 60 * 1000;

  await prisma.expedition.update({
    where: { id: expedition.id },
    data: {
      completionRate: engagement.completionRate,
      skipRate: engagement.skipRate,
      saveCount: engagement.saveCount,
    },
  });

  const hasEnoughData = engagement.playedTrackCount >= MIN_PLAYED_TRACKS;
  if (!hasEnoughData && !forceClose) {
    return "pending"; // leave active, re-check on next poll
  }

  const decision = decide(engagement);

  if (decision === "claimed") {
    await handleClaim(userId, expedition, engagement);
  } else if (decision === "retreated") {
    await handleRetreat(userId, expedition, engagement);
  } else {
    await prisma.expedition.update({
      where: { id: expedition.id },
      data: { status: "inconclusive", resolvedAt: new Date() },
    });
  }

  return decision;
}

function decide(engagement: EngagementResult): Decision {
  if (engagement.saveCount >= 1 || engagement.completionRate >= 0.6) return "claimed";
  if (engagement.skipRate >= 0.6 && engagement.saveCount === 0) return "retreated";
  return "inconclusive";
}

async function handleClaim(userId: string, expedition: Expedition, engagement: EngagementResult): Promise<void> {
  const territory = await prisma.territory.update({
    where: { id: expedition.territoryId },
    data: { status: "claimed", claimedAt: new Date() },
  });

  await prisma.trackFeature.updateMany({
    where: { userId, spotifyTrackId: { in: expedition.trackIds } },
    data: { territoryId: territory.id },
  });

  const rationale = await generateRationale({
    territoryLabel: territory.label,
    decision: "claimed",
    stats: {
      saveCount: engagement.saveCount,
      completionRate: engagement.completionRate,
      skipRate: engagement.skipRate,
      trackCount: expedition.trackIds.length,
    },
  });

  await prisma.territoryEvent.create({
    data: { userId, territoryId: territory.id, type: "claimed", rationale },
  });

  await prisma.expedition.update({
    where: { id: expedition.id },
    data: { status: "claimed", resolvedAt: new Date() },
  });
}

async function handleRetreat(userId: string, expedition: Expedition, engagement: EngagementResult): Promise<void> {
  const territory = await prisma.territory.update({
    where: { id: expedition.territoryId },
    data: { status: "retreated", retreatedAt: new Date() },
  });

  const rationale = await generateRationale({
    territoryLabel: territory.label,
    decision: "retreated",
    stats: {
      saveCount: engagement.saveCount,
      completionRate: engagement.completionRate,
      skipRate: engagement.skipRate,
      trackCount: expedition.trackIds.length,
    },
  });

  await prisma.territoryEvent.create({
    data: { userId, territoryId: territory.id, type: "retreated", rationale },
  });

  await prisma.expedition.update({
    where: { id: expedition.id },
    data: { status: "retreated", resolvedAt: new Date() },
  });
}

/** Polls and resolves every active expedition for a user (in practice, at most one — PRD 6.4 constraint). */
export async function pollAndResolveActiveExpeditions(userId: string): Promise<(Decision | "pending")[]> {
  const activeExpeditions = await prisma.expedition.findMany({ where: { userId, status: "active" } });
  const results: (Decision | "pending")[] = [];
  for (const expedition of activeExpeditions) {
    results.push(await resolveExpedition(userId, expedition));
  }
  return results;
}
