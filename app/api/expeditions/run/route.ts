import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import {
  runExpeditionPlanner,
  NoActiveExpeditionSlotError,
  NoFrontierCandidateError,
} from "@/lib/expeditionPlanner";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (user.expeditionsPaused) {
    return NextResponse.json({ error: "Expeditions are paused for this account" }, { status: 409 });
  }

  let requestedGenre: string | undefined;
  try {
    const body = await req.json();
    requestedGenre = body?.genre;
  } catch {
    // no body provided — auto-select mode
  }

  try {
    const expedition = await runExpeditionPlanner(user.id, requestedGenre);
    return NextResponse.json({ expedition });
  } catch (e) {
    if (e instanceof NoActiveExpeditionSlotError) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    if (e instanceof NoFrontierCandidateError) {
      return NextResponse.json({ error: e.message }, { status: 422 });
    }
    console.error("Expedition planning failed", e);
    return NextResponse.json({ error: "Failed to plan expedition" }, { status: 500 });
  }
}
