import { AudioFeatureVector, RawTrack } from "@/types";

const API_BASE = "https://api.spotify.com/v1";
const ACCOUNTS_BASE = "https://accounts.spotify.com/api/token";

export class SpotifyApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "SpotifyApiError";
  }
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const clientId = process.env.SPOTIFY_CLIENT_ID!;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET!;
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch(ACCOUNTS_BASE, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    throw new SpotifyApiError(`Failed to refresh token: ${await res.text()}`, res.status);
  }

  return res.json();
}

export class SpotifyClient {
  constructor(private accessToken: string) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new SpotifyApiError(`Spotify API error on ${path}: ${res.status} ${body}`, res.status);
    }

    if (res.status === 204) return undefined as T;
    return res.json();
  }

  async getMe(): Promise<{ id: string; display_name: string; email: string }> {
    return this.request("/me");
  }

  async getTopTracks(limit = 50): Promise<RawTrack[]> {
    const data = await this.request<{ items: SpotifyTrack[] }>(
      `/me/top/tracks?time_range=medium_term&limit=${limit}`,
    );
    return data.items.map((t) => toRawTrack(t, "top_tracks"));
  }

  async getRecentlyPlayed(limit = 50, after?: number): Promise<{ track: RawTrack; playedAt: string }[]> {
    const afterParam = after ? `&after=${after}` : "";
    const data = await this.request<{ items: { track: SpotifyTrack; played_at: string }[] }>(
      `/me/player/recently-played?limit=${limit}${afterParam}`,
    );
    return data.items.map((i) => ({ track: toRawTrack(i.track, "recently_played"), playedAt: i.played_at }));
  }

  async getSavedTracks(limit = 50): Promise<RawTrack[]> {
    const data = await this.request<{ items: { track: SpotifyTrack }[] }>(`/me/tracks?limit=${limit}`);
    return data.items.map((i) => toRawTrack(i.track, "saved_tracks"));
  }

  async getAudioFeatures(trackIds: string[]): Promise<Map<string, AudioFeatureVector>> {
    const result = new Map<string, AudioFeatureVector>();
    for (let i = 0; i < trackIds.length; i += 100) {
      const batch = trackIds.slice(i, i + 100);
      const data = await this.request<{ audio_features: (SpotifyAudioFeatures | null)[] }>(
        `/audio-features?ids=${batch.join(",")}`,
      );
      for (const f of data.audio_features) {
        if (!f) continue;
        result.set(f.id, {
          danceability: f.danceability,
          energy: f.energy,
          valence: f.valence,
          acousticness: f.acousticness,
          instrumentalness: f.instrumentalness,
          tempo: f.tempo,
          mode: f.mode,
          key: f.key,
        });
      }
    }
    return result;
  }

  async getArtistGenres(artistIds: string[]): Promise<Map<string, string[]>> {
    const result = new Map<string, string[]>();
    const uniqueIds = Array.from(new Set(artistIds));
    for (let i = 0; i < uniqueIds.length; i += 50) {
      const batch = uniqueIds.slice(i, i + 50);
      const data = await this.request<{ artists: { id: string; genres: string[] }[] }>(
        `/artists?ids=${batch.join(",")}`,
      );
      for (const a of data.artists) {
        if (a) result.set(a.id, a.genres);
      }
    }
    return result;
  }

  async getRelatedArtistGenres(artistId: string): Promise<string[]> {
    const data = await this.request<{ artists: { genres: string[] }[] }>(
      `/artists/${artistId}/related-artists`,
    );
    return Array.from(new Set(data.artists.flatMap((a) => a.genres)));
  }

  async getAvailableGenreSeeds(): Promise<string[]> {
    const data = await this.request<{ genres: string[] }>("/recommendations/available-genre-seeds");
    return data.genres;
  }

  async getRecommendations(params: {
    seedGenres: string[];
    targetFeatures: Partial<AudioFeatureVector>;
    limit?: number;
  }): Promise<RawTrack[]> {
    const search = new URLSearchParams();
    search.set("seed_genres", params.seedGenres.slice(0, 5).join(","));
    search.set("limit", String(params.limit ?? 5));
    for (const [key, value] of Object.entries(params.targetFeatures)) {
      if (value !== undefined) search.set(`target_${key}`, String(value));
    }
    const data = await this.request<{ tracks: SpotifyTrack[] }>(`/recommendations?${search.toString()}`);
    return data.tracks.map((t) => toRawTrack(t, "expedition"));
  }

  async createPlaylist(userId: string, name: string, description: string): Promise<{ id: string; url: string }> {
    const data = await this.request<{ id: string; external_urls: { spotify: string } }>(
      `/users/${userId}/playlists`,
      {
        method: "POST",
        body: JSON.stringify({ name, description, public: false }),
      },
    );
    return { id: data.id, url: data.external_urls.spotify };
  }

  async addTracksToPlaylist(playlistId: string, trackIds: string[]): Promise<void> {
    await this.request(`/playlists/${playlistId}/tracks`, {
      method: "POST",
      body: JSON.stringify({ uris: trackIds.map((id) => `spotify:track:${id}`) }),
    });
  }

  async checkSavedTracks(trackIds: string[]): Promise<Map<string, boolean>> {
    const result = new Map<string, boolean>();
    for (let i = 0; i < trackIds.length; i += 50) {
      const batch = trackIds.slice(i, i + 50);
      const data = await this.request<boolean[]>(`/me/tracks/contains?ids=${batch.join(",")}`);
      batch.forEach((id, idx) => result.set(id, data[idx]));
    }
    return result;
  }
}

interface SpotifyTrack {
  id: string;
  name: string;
  duration_ms: number;
  artists: { id: string; name: string }[];
}

interface SpotifyAudioFeatures extends AudioFeatureVector {
  id: string;
}

function toRawTrack(t: SpotifyTrack, source: RawTrack["source"]): RawTrack {
  return {
    spotifyTrackId: t.id,
    trackName: t.name,
    artistName: t.artists[0]?.name ?? "Unknown Artist",
    artistId: t.artists[0]?.id ?? "",
    durationMs: t.duration_ms,
    source,
  };
}
