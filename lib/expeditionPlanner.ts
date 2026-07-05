import { prisma } from "@/lib/prisma";
import { SpotifyClient } from "@/lib/spotify";
import { getValidAccessToken } from "@/lib/session";
import { isMockMode, loadMockReservePool, seededRandom, mockTrackToRawTrack, MockTrackFixture } from "@/lib/mock";
import { topGenres } from "@/lib/clustering";
import { recomputeMapProjection } from "@/lib/territoryEngine";
import { AudioFeatureVector, RawTrack } from "@/types";
import type { Territory } from "@prisma/client";

const OFFSET_MIN = 0.15;
const OFFSET_MAX = 0.2;
const OFFSETTABLE_FEATURES: (keyof AudioFeatureVector)[] = [
  "danceability",
  "energy",
  "valence",
  "acousticness",
  "instrumentalness",
];

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/** PRD 6.6: genres of member tracks belonging to durably-retreated territories, never re-suggested. */
export async function getExcludedGenres(userId: string): Promise<Set<string>> {
  const retreated = await prisma.territory.findMany({
    where: { userId, status: "retreated" },
    include: { tracks: true },
  });
  return new Set(retreated.flatMap((t) => t.tracks.flatMap((tr) => tr.genres)));
}

/** Top-3 genre tags of each claimed territory's member tracks — considered "already explored." */
export async function getWellRepresentedGenres(userId: string): Promise<Set<string>> {
  const claimed = await prisma.territory.findMany({
    where: { userId, status: "claimed" },
    include: { tracks: true },
  });
  const genres = new Set<string>();
  for (const t of claimed) {
    for (const g of topGenres(t.tracks.map((tr) => tr.genres), 3)) genres.add(g);
  }
  return genres;
}

export interface FrontierCandidate {
  genre: string;
  anchorTerritory: Territory;
  targetFeatures: AudioFeatureVector;
}

/** PRD 6.4 steps 1-2: pick one adjacent, not-yet-explored genre near an existing claimed territory. */
export async function chooseFrontierCandidate(
  userId: string,
  requestedGenre?: string,
): Promise<FrontierCandidate | null> {
  const claimedTerritories = await prisma.territory.findMany({
    where: { userId, status: "claimed" },
    include: { _count: { select: { tracks: true } } },
    orderBy: { createdAt: "asc" },
  });
  if (claimedTerritories.length === 0) return null;

  const excluded = await getExcludedGenres(userId);
  const wellRepresented = await getWellRepresentedGenres(userId);

  const eligibleGenres = requestedGenre
    ? [requestedGenre].filter((g) => !excluded.has(g))
    : await listEligibleCandidateGenres(userId, excluded, wellRepresented);

  if (eligibleGenres.length === 0) return null;
  const genre = eligibleGenres[0];

  // Anchor to the claimed territory with the most tracks (most established taste signal).
  const anchorTerritory = [...claimedTerritories].sort(
    (a, b) => b._count.tracks - a._count.tracks,
  )[0] as Territory;
  const anchorCentroid = anchorTerritory.centroidVector as unknown as AudioFeatureVector;

  const rand = seededRandom(`${userId}-${genre}-offset`);
  const targetFeatures: AudioFeatureVector = { ...anchorCentroid };
  for (const feature of OFFSETTABLE_FEATURES) {
    const magnitude = OFFSET_MIN + rand() * (OFFSET_MAX - OFFSET_MIN);
    const direction = rand() > 0.5 ? 1 : -1;
    targetFeatures[feature] = clamp01(anchorCentroid[feature] + magnitude * direction);
  }

  return { genre, anchorTerritory, targetFeatures };
}

export async function listEligibleCandidateGenres(
  userId: string,
  excluded: Set<string>,
  wellRepresented: Set<string>,
): Promise<string[]> {
  if (isMockMode()) {
    const usedLabels = new Set(
      (await prisma.territory.findMany({ where: { userId }, select: { label: true } })).map((t) => t.label),
    );
    const reserveByCluster = new Map<string, MockTrackFixture[]>();
    for (const t of loadMockReservePool()) {
      const list = reserveByCluster.get(t.clusterName) ?? [];
      list.push(t);
      reserveByCluster.set(t.clusterName, list);
    }
    const eligible: string[] = [];
    for (const [clusterName, tracks] of Array.from(reserveByCluster.entries())) {
      if (usedLabels.has(clusterName)) continue;
      const primaryGenre = tracks[0].genres[0];
      if (excluded.has(primaryGenre) || wellRepresented.has(primaryGenre)) continue;
      eligible.push(clusterName);
    }
    return eligible;
  }

  const accessToken = await getValidAccessToken(userId);
  const client = new SpotifyClient(accessToken);
  const topTracks = await client.getTopTracks(20);
  const artistIds = Array.from(new Set(topTracks.map((t) => t.artistId))).slice(0, 5);
  const relatedGenreLists = await Promise.all(artistIds.map((id) => client.getRelatedArtistGenres(id)));
  const availableSeeds = await client.getAvailableGenreSeeds();

  const candidateSet = new Set([...relatedGenreLists.flat(), ...availableSeeds]);
  return Array.from(candidateSet).filter((g) => !excluded.has(g) && !wellRepresented.has(g));
}

export interface ExpeditionTrackData {
  raw: RawTrack;
  features: AudioFeatureVector;
  genres: string[];
}

/** Resolves 5 concrete candidate tracks for a chosen frontier genre (PRD 6.4 step 3). */
export async function fetchExpeditionTracks(
  userId: string,
  candidate: FrontierCandidate,
): Promise<ExpeditionTrackData[]> {
  if (isMockMode()) {
    const pool = loadMockReservePool().filter((t) => t.clusterName === candidate.genre);
    return pool.slice(0, 5).map((t) => ({
      raw: mockTrackToRawTrack(t, "expedition"),
      features: t.audioFeatures,
      genres: t.genres,
    }));
  }

  const accessToken = await getValidAccessToken(userId);
  const client = new SpotifyClient(accessToken);
  const tracks = await client.getRecommendations({
    seedGenres: [candidate.genre],
    targetFeatures: candidate.targetFeatures,
    limit: 5,
  });

  const trackIds = tracks.map((t) => t.spotifyTrackId);
  const artistIds = tracks.map((t) => t.artistId).filter(Boolean);
  const [featuresMap, genresMap] = await Promise.all([
    client.getAudioFeatures(trackIds),
    client.getArtistGenres(artistIds),
  ]);

  return tracks
    .filter((t) => featuresMap.has(t.spotifyTrackId))
    .map((t) => ({
      raw: t,
      features: featuresMap.get(t.spotifyTrackId)!,
      genres: genresMap.get(t.artistId) ?? [candidate.genre],
    }));
}

export class NoActiveExpeditionSlotError extends Error {
  constructor() {
    super("An expedition is already active. Only one active expedition is allowed at a time.");
    this.name = "NoActiveExpeditionSlotError";
  }
}

export class NoFrontierCandidateError extends Error {
  constructor() {
    super("No adjacent, unexplored genre is currently eligible for a new expedition.");
    this.name = "NoFrontierCandidateError";
  }
}

/** PRD 6.4: full expedition planning flow — creates a real (or mock) Spotify playlist. */
export async function runExpeditionPlanner(userId: string, requestedGenre?: string) {
  const activeExpedition = await prisma.expedition.findFirst({ where: { userId, status: "active" } });
  if (activeExpedition) throw new NoActiveExpeditionSlotError();

  const candidate = await chooseFrontierCandidate(userId, requestedGenre);
  if (!candidate) throw new NoFrontierCandidateError();

  const trackData = await fetchExpeditionTracks(userId, candidate);
  if (trackData.length === 0) throw new NoFrontierCandidateError();

  const territoryLabel = isMockMode() ? candidate.genre : titleCase(candidate.genre);

  let spotifyPlaylistId: string;
  if (isMockMode()) {
    spotifyPlaylistId = `mock-playlist-${Buffer.from(`${userId}-${territoryLabel}-${Date.now()}`).toString("base64url").slice(0, 16)}`;
  } else {
    const accessToken = await getValidAccessToken(userId);
    const client = new SpotifyClient(accessToken);
    const me = await client.getMe();
    const playlist = await client.createPlaylist(
      me.id,
      `Frontier: ${territoryLabel} Expedition`,
      `An adjacent-genre expedition scouted by Frontier, seeded near your "${candidate.anchorTerritory.label}" territory.`,
    );
    await client.addTracksToPlaylist(
      playlist.id,
      trackData.map((t) => t.raw.spotifyTrackId),
    );
    spotifyPlaylistId = playlist.id;
  }

  const territory = await prisma.territory.create({
    data: {
      userId,
      label: territoryLabel,
      centroidVector: candidate.targetFeatures as unknown as object,
      status: "frontier",
    },
  });

  for (const t of trackData) {
    await prisma.trackFeature.upsert({
      where: { userId_spotifyTrackId: { userId, spotifyTrackId: t.raw.spotifyTrackId } },
      update: { territoryId: territory.id, source: "expedition" },
      create: {
        userId,
        spotifyTrackId: t.raw.spotifyTrackId,
        trackName: t.raw.trackName,
        artistName: t.raw.artistName,
        genres: t.genres,
        danceability: t.features.danceability,
        energy: t.features.energy,
        valence: t.features.valence,
        acousticness: t.features.acousticness,
        instrumentalness: t.features.instrumentalness,
        tempo: t.features.tempo,
        mode: t.features.mode,
        key: t.features.key,
        source: "expedition",
        territoryId: territory.id,
      },
    });
  }

  await recomputeMapProjection(userId);

  const expedition = await prisma.expedition.create({
    data: {
      userId,
      territoryId: territory.id,
      spotifyPlaylistId,
      trackIds: trackData.map((t) => t.raw.spotifyTrackId),
      status: "active",
    },
  });

  return expedition;
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}
