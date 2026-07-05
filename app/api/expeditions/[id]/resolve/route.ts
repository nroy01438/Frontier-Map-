import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { manuallyResolveExpedition, ExpeditionNotActiveError } from "@/lib/decisionPolicy";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const decision = body?.decision;
  if (decision !== "claimed" && decision !== "retreated") {
    return NextResponse.json({ error: "decision must be 'claimed' or 'retreated'" }, { status: 400 });
  }

  try {
    await manuallyResolveExpedition(user.id, params.id, decision);
    return NextResponse.json({ ok: true, decision });
  } catch (e) {
    if (e instanceof ExpeditionNotActiveError) {
      return NextResponse.json({ error: e.message }, { status: 404 });
    }
    console.error("Manual expedition resolve failed", e);
    return NextResponse.json({ error: "Failed to resolve expedition" }, { status: 500 });
  }
}
