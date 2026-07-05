import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { toTerritoryDTO, toTerritoryEventDTO } from "@/lib/dto";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const territory = await prisma.territory.findFirst({
    where: { id: params.id, userId: user.id },
    include: { tracks: true },
  });
  if (!territory) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const events = await prisma.territoryEvent.findMany({
    where: { territoryId: territory.id, userId: user.id },
    include: { territory: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    territory: toTerritoryDTO(territory),
    events: events.map(toTerritoryEventDTO),
  });
}
