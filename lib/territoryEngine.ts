import { prisma } from "@/lib/prisma";
import {
  clusterTracks,
  cosineSimilarity,
  fromFeatureVector,
  movingAverageCentroid,
  projectTo2D,
  toFeatureVector,
  topGenres,
  TERRITORY_MATCH_THRESHOLD,
} from "@/lib/clustering";
import { labelCluster } from "@/lib/llm";
import { AudioFeatureVector } from "@/types";
import type { TrackFeature } from "@prisma/client";
import { Prisma } from "@prisma/client";

const LISTENING_SOURCES = ["top_tracks", "recently_played", "saved_tracks"];

interface MatchCandidate {
  id: string;
  centroidVector: AudioFeatureVector;
  trackCount: number;
}

function trackToVector(t: TrackFeature): number[] {
  return toFeatureVector({
    danceability: t.danceability,
    energy: t.energy,
    valence: t.valence,
    acousticness: t.acousticness,
    instrumentalness: t.instrumentalness,
    tempo: t.tempo,
    mode: t.mode,
    key: t.key,
  });
}

/**
 * PRD 6.2/6.3: re-cluster a user's listening-history tracks into territories, matching
 * against existing territories by cosine similarity, labeling new ones via the LLM, and
 * recomputing the 2D PCA map projection for all of the user's tracks.
 */
export async function recomputeTerritories(userId: string): Promise<void> {
  const listeningTracks = await prisma.trackFeature.findMany({
    where: { userId, source: { in: LISTENING_SOURCES } },
  });

  if (listeningTracks.length > 0) {
    const vectors = listeningTracks.map(trackToVector);
    const clusters = clusterTracks(vectors);

    const byClusterIndex = new Map<number, { tracks: TrackFeature[]; centroid: number[] }>();
    clusters.forEach((c, i) => {
      const entry = byClusterIndex.get(c.clusterIndex) ?? { tracks: [], centroid: c.centroid };
      entry.tracks.push(listeningTracks[i]);
      byClusterIndex.set(c.clusterIndex, entry);
    });

    const existingTerritories = await prisma.territory.findMany({
      where: { userId },
      include: { _count: { select: { tracks: true } } },
    });
    const candidates: MatchCandidate[] = existingTerritories.map((t) => ({
      id: t.id,
      centroidVector: t.centroidVector as unknown as AudioFeatureVector,
      trackCount: t._count.tracks,
    }));

    let labelSeed = 0;
    for (const { tracks, centroid } of Array.from(byClusterIndex.values())) {
      const match = findBestMatch(centroid, candidates);

      if (match) {
        const updatedCentroid = movingAverageCentroid(
          toFeatureVector(match.centroidVector),
          centroid,
          match.trackCount,
        );
        await prisma.territory.update({
          where: { id: match.id },
          data: { centroidVector: fromFeatureVector(updatedCentroid) as unknown as Prisma.InputJsonValue },
        });
        await prisma.trackFeature.updateMany({
          where: { id: { in: tracks.map((t) => t.id) } },
          data: { territoryId: match.id },
        });
        match.centroidVector = fromFeatureVector(updatedCentroid);
        match.trackCount += tracks.length;
      } else {
        const label = await labelCluster(
          {
            centroid: fromFeatureVector(centroid),
            topGenres: topGenres(tracks.map((t) => t.genres)),
            exampleTracks: tracks.slice(0, 5).map((t) => ({ trackName: t.trackName, artistName: t.artistName })),
          },
          labelSeed++,
        );
        const territory = await prisma.territory.create({
          data: {
            userId,
            label,
            centroidVector: fromFeatureVector(centroid) as unknown as Prisma.InputJsonValue,
            status: "claimed",
            claimedAt: new Date(),
          },
        });
        await prisma.trackFeature.updateMany({
          where: { id: { in: tracks.map((t) => t.id) } },
          data: { territoryId: territory.id },
        });
        candidates.push({ id: territory.id, centroidVector: fromFeatureVector(centroid), trackCount: tracks.length });
      }
    }
  }

  await recomputeMapProjection(userId);
}

function findBestMatch(centroid: number[], candidates: MatchCandidate[]): MatchCandidate | null {
  let best: MatchCandidate | null = null;
  let bestSim = TERRITORY_MATCH_THRESHOLD;
  for (const candidate of candidates) {
    const sim = cosineSimilarity(centroid, toFeatureVector(candidate.centroidVector));
    if (sim > bestSim) {
      bestSim = sim;
      best = candidate;
    }
  }
  return best;
}

/** Exported so newly-created expedition tracks (which arrive outside recomputeTerritories) also get map coords. */
export async function recomputeMapProjection(userId: string): Promise<void> {
  const allTracks = await prisma.trackFeature.findMany({ where: { userId } });
  if (allTracks.length < 2) return;

  const vectors = allTracks.map(trackToVector);
  const points = projectTo2D(vectors);

  await Promise.all(
    allTracks.map((t, i) =>
      prisma.trackFeature.update({
        where: { id: t.id },
        data: { mapX: points[i].x, mapY: points[i].y },
      }),
    ),
  );
}
