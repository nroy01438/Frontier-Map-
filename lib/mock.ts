import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/encryption";
import mockTracksFixture from "@/lib/fixtures/mockTracks.json";
import { RawTrack, AudioFeatureVector } from "@/types";

export const MOCK_SPOTIFY_ID = "mock-demo-user";
export const MOCK_SPOTIFY_USER_ACCOUNT_ID = "mock-demo-user-account";

export function isMockMode(): boolean {
  return process.env.MOCK_MODE === "true";
}

export function isMockLLM(): boolean {
  return process.env.MOCK_LLM === "true" || isMockMode();
}

export async function ensureMockUser() {
  return prisma.user.upsert({
    where: { spotifyId: MOCK_SPOTIFY_ID },
    update: {},
    create: {
      spotifyId: MOCK_SPOTIFY_ID,
      displayName: "Demo Listener",
      email: "demo@frontier.local",
      accessToken: encrypt("mock-access-token"),
      refreshToken: encrypt("mock-refresh-token"),
      tokenExpiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365),
    },
  });
}

export interface MockTrackFixture {
  spotifyTrackId: string;
  trackName: string;
  artistName: string;
  artistId: string;
  durationMs: number;
  genres: string[];
  audioFeatures: AudioFeatureVector;
  pool: "baseline" | "reserve";
  clusterName: string;
}

export function loadMockTracks(): MockTrackFixture[] {
  return mockTracksFixture as MockTrackFixture[];
}

/** Baseline tracks simulate the user's existing listening history (ingested immediately). */
export function loadMockBaselineTracks(): MockTrackFixture[] {
  return loadMockTracks().filter((t) => t.pool === "baseline");
}

/** Reserve tracks simulate adjacent, not-yet-explored genres — the candidate pool for expeditions. */
export function loadMockReservePool(): MockTrackFixture[] {
  return loadMockTracks().filter((t) => t.pool === "reserve");
}

export function mockTrackToRawTrack(t: MockTrackFixture, source: RawTrack["source"]): RawTrack {
  return {
    spotifyTrackId: t.spotifyTrackId,
    trackName: t.trackName,
    artistName: t.artistName,
    artistId: t.artistId,
    durationMs: t.durationMs,
    source,
  };
}

/** Deterministic PRNG (mulberry32) seeded from a string, for repeatable demo outcomes. */
export function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SimulatedEngagement {
  trackId: string;
  completed: boolean;
  saved: boolean;
}

/**
 * Simulates polling outcomes for an expedition's tracks in MOCK_MODE, seeded by
 * expedition id so repeated polls of the same expedition converge deterministically.
 */
export function simulateExpeditionEngagement(expeditionId: string, trackIds: string[]): SimulatedEngagement[] {
  const rand = seededRandom(expeditionId);
  // Bias the simulation so ~50% of demo expeditions trend toward "claimed" and ~50% toward "retreated".
  const bias = rand();
  return trackIds.map((trackId) => {
    const completed = bias > 0.45 ? rand() > 0.35 : rand() > 0.8;
    const saved = bias > 0.45 && rand() > 0.7;
    return { trackId, completed, saved };
  });
}
