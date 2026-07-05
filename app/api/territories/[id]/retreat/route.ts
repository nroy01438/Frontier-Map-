import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const territory = await prisma.territory.findFirst({ where: { id: params.id, userId: user.id } });
  if (!territory) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (territory.status !== "claimed") {
    return NextResponse.json({ error: "Only claimed territories can be manually retreated from" }, { status: 409 });
  }

  const updated = await prisma.territory.update({
    where: { id: territory.id },
    data: { status: "retreated", retreatedAt: new Date() },
  });

  const rationale = `You manually retreated from "${territory.label}" — Frontier won't scout this direction again.`;
  await prisma.territoryEvent.create({
    data: { userId: user.id, territoryId: updated.id, type: "manual_retreat", rationale },
  });

  return NextResponse.json({ territory: updated });
}
