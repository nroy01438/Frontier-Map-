import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { ingestUserData } from "@/lib/ingestion";
import { recomputeTerritories } from "@/lib/territoryEngine";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { ingestedCount } = await ingestUserData(user.id);
  await recomputeTerritories(user.id);

  return NextResponse.json({ ingestedCount });
}
