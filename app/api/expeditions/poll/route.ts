import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { pollAndResolveActiveExpeditions } from "@/lib/decisionPolicy";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const results = await pollAndResolveActiveExpeditions(user.id);
  return NextResponse.json({ results });
}
