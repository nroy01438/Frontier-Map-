import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { toTerritoryEventDTO } from "@/lib/dto";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const events = await prisma.territoryEvent.findMany({
    where: { userId: user.id },
    include: { territory: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ events: events.map(toTerritoryEventDTO) });
}
