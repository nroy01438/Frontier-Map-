import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { toTerritoryDTO } from "@/lib/dto";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const territories = await prisma.territory.findMany({
    where: { userId: user.id },
    include: { tracks: true },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ territories: territories.map(toTerritoryDTO) });
}
