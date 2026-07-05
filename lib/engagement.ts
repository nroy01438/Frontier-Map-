import { SpotifyClient } from "@/lib/spotify";
import { getValidAccessToken } from "@/lib/session";
import { isMockMode, simulateExpeditionEngagement } from "@/lib/mock";
import type { Expedition } from "@prisma/client";

export interface EngagementResult {
  completionRate: number;
  skipRate: number;
  saveCount: number;
  playedTrackCount: number;
}

const COMPLETION_RATIO_THRESHOLD = 0.8;

/**
 * PRD 6.5: Spotify's public API exposes no skip webhook, so engagement is approximated by
 * polling `recently-played` and inferring listened duration from the gap between consecutive
 * play timestamps. A track with no next timestamp (last item in the window) is conservatively
 * treated as not-completed. This is a documented approximation, not exact skip detection.
 */
export async function measureExpeditionEngagement(userId: string, expedition: Expedition): Promise<EngagementResult> {
  if (isMockMode()) {
    const sim = simulateExpeditionEngagement(expedition.id, expedition.trackIds);
    const playedTrackCount = sim.length;
    const completedCount = sim.filter((s) => s.completed).length;
    const saveCount = sim.filter((s) => s.saved).length;
    return {
      completionRate: playedTrackCount ? completedCount / playedTrackCount : 0,
      skipRate: playedTrackCount ? (playedTrackCount - completedCount) / playedTrackCount : 0,
      saveCount,
      playedTrackCount,
    };
  }

  const accessToken = await getValidAccessToken(userId);
  const client = new SpotifyClient(accessToken);

  const recentlyPlayed = await client.getRecentlyPlayed(50, expedition.createdAt.getTime());
  const sorted = [...recentlyPlayed].sort(
    (a, b) => new Date(a.playedAt).getTime() - new Date(b.playedAt).getTime(),
  );

  const trackIdSet = new Set(expedition.trackIds);
  const completionByTrack = new Map<string, boolean>();

  sorted.forEach((item, idx) => {
    if (!trackIdSet.has(item.track.spotifyTrackId)) return;
    const next = sorted[idx + 1];
    let completed = false;
    if (next) {
      const listenedMs = new Date(next.playedAt).getTime() - new Date(item.playedAt).getTime();
      completed = listenedMs / item.track.durationMs >= COMPLETION_RATIO_THRESHOLD;
    }
    completionByTrack.set(
      item.track.spotifyTrackId,
      completionByTrack.get(item.track.spotifyTrackId) || completed,
    );
  });

  const playedTrackCount = completionByTrack.size;
  const completedCount = Array.from(completionByTrack.values()).filter(Boolean).length;

  const savedMap = await client.checkSavedTracks(expedition.trackIds);
  const saveCount = Array.from(savedMap.values()).filter(Boolean).length;

  return {
    completionRate: playedTrackCount ? completedCount / playedTrackCount : 0,
    skipRate: playedTrackCount ? (playedTrackCount - completedCount) / playedTrackCount : 0,
    saveCount,
    playedTrackCount,
  };
}
