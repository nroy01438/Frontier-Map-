import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { toExpeditionDTO } from "@/lib/dto";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const expeditions = await prisma.expedition.findMany({
    where: { userId: user.id },
    include: { territory: true },
    orderBy: { createdAt: "desc" },
  });

  const allTrackIds = Array.from(new Set(expeditions.flatMap((e) => e.trackIds)));
  const tracks = await prisma.trackFeature.findMany({
    where: { userId: user.id, spotifyTrackId: { in: allTrackIds } },
  });
  const trackById = new Map(tracks.map((t) => [t.spotifyTrackId, t]));

  const dtos = expeditions.map((e) =>
    toExpeditionDTO({
      ...e,
      trackDetails: e.trackIds.map((id) => {
        const t = trackById.get(id);
        return { spotifyTrackId: id, trackName: t?.trackName ?? id, artistName: t?.artistName ?? "" };
      }),
    }),
  );

  return NextResponse.json({ expeditions: dtos });
}
