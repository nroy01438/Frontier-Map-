import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  getExcludedGenres,
  getWellRepresentedGenres,
  listEligibleCandidateGenres,
  runExpeditionPlanner,
  NoActiveExpeditionSlotError,
  NoFrontierCandidateError,
} from "@/lib/expeditionPlanner";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const excluded = await getExcludedGenres(user.id);
  const wellRepresented = await getWellRepresentedGenres(user.id);
  const genres = await listEligibleCandidateGenres(user.id, excluded, wellRepresented);

  return NextResponse.json({ genres });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.expeditionsPaused) {
    return NextResponse.json({ error: "Expeditions are paused for this account" }, { status: 409 });
  }

  const body = await req.json().catch(() => null);
  const genre = body?.genre as string | undefined;
  if (!genre) return NextResponse.json({ error: "A genre is required" }, { status: 400 });

  try {
    const expedition = await runExpeditionPlanner(user.id, genre);

    const rationale = `You sent a scout toward "${genre}" — Frontier launched an expedition to explore it.`;
    await prisma.territoryEvent.create({
      data: { userId: user.id, territoryId: expedition.territoryId, type: "manual_scout", rationale },
    });

    return NextResponse.json({ expedition });
  } catch (e) {
    if (e instanceof NoActiveExpeditionSlotError) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    if (e instanceof NoFrontierCandidateError) {
      return NextResponse.json({ error: e.message }, { status: 422 });
    }
    console.error("Manual scout failed", e);
    return NextResponse.json({ error: "Failed to send scout" }, { status: 500 });
  }
}
