import { prisma } from "@/lib/prisma";
import { SpotifyClient } from "@/lib/spotify";
import { getValidAccessToken } from "@/lib/session";
import { isMockMode, loadMockBaselineTracks, mockTrackToRawTrack } from "@/lib/mock";
import { AudioFeatureVector, RawTrack } from "@/types";

interface IngestedTrack extends RawTrack {
  features: AudioFeatureVector;
  genres: string[];
}

/** PRD 6.1: pull top tracks, recently played, and saved tracks; enrich with audio features + genres. */
export async function ingestUserData(userId: string): Promise<{ ingestedCount: number }> {
  const tracks = isMockMode() ? ingestMock() : await ingestReal(userId);

  for (const t of tracks) {
    await prisma.trackFeature.upsert({
      where: { userId_spotifyTrackId: { userId, spotifyTrackId: t.spotifyTrackId } },
      update: {
        trackName: t.trackName,
        artistName: t.artistName,
        genres: t.genres,
        danceability: t.features.danceability,
        energy: t.features.energy,
        valence: t.features.valence,
        acousticness: t.features.acousticness,
        instrumentalness: t.features.instrumentalness,
        tempo: t.features.tempo,
        mode: t.features.mode,
        key: t.features.key,
      },
      create: {
        userId,
        spotifyTrackId: t.spotifyTrackId,
        trackName: t.trackName,
        artistName: t.artistName,
        genres: t.genres,
        danceability: t.features.danceability,
        energy: t.features.energy,
        valence: t.features.valence,
        acousticness: t.features.acousticness,
        instrumentalness: t.features.instrumentalness,
        tempo: t.features.tempo,
        mode: t.features.mode,
        key: t.features.key,
        source: t.source,
      },
    });
  }

  return { ingestedCount: tracks.length };
}

async function ingestReal(userId: string): Promise<IngestedTrack[]> {
  const accessToken = await getValidAccessToken(userId);
  const client = new SpotifyClient(accessToken);

  const [topTracks, recentlyPlayedItems, savedTracks] = await Promise.all([
    client.getTopTracks(50),
    client.getRecentlyPlayed(50),
    client.getSavedTracks(50),
  ]);
  const recentlyPlayed = recentlyPlayedItems.map((i) => i.track);

  const byId = new Map<string, RawTrack>();
  for (const t of [...topTracks, ...recentlyPlayed, ...savedTracks]) {
    if (!byId.has(t.spotifyTrackId)) byId.set(t.spotifyTrackId, t);
  }

  const rawTracks = Array.from(byId.values());
  const trackIds = rawTracks.map((t) => t.spotifyTrackId);
  const artistIds = rawTracks.map((t) => t.artistId).filter(Boolean);

  const [featuresMap, genresMap] = await Promise.all([
    client.getAudioFeatures(trackIds),
    client.getArtistGenres(artistIds),
  ]);

  const result: IngestedTrack[] = [];
  for (const t of rawTracks) {
    const features = featuresMap.get(t.spotifyTrackId);
    if (!features) continue; // podcasts/local files etc. have no audio features
    result.push({ ...t, features, genres: genresMap.get(t.artistId) ?? [] });
  }
  return result;
}

function ingestMock(): IngestedTrack[] {
  const fixtures = loadMockBaselineTracks();
  return fixtures.map((f, idx) => ({
    ...mockTrackToRawTrack(f, idx % 5 === 0 ? "saved_tracks" : idx % 3 === 0 ? "recently_played" : "top_tracks"),
    features: f.audioFeatures,
    genres: f.genres,
  }));
}
