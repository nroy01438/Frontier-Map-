export type TerritoryStatus = "claimed" | "frontier" | "retreated";

export type ExpeditionStatus = "active" | "claimed" | "retreated" | "inconclusive";

export type TerritoryEventType =
  | "claimed"
  | "retreated"
  | "manual_scout"
  | "manual_retreat";

export type TrackSource = "top_tracks" | "recently_played" | "saved_tracks" | "expedition";

export interface AudioFeatureVector {
  danceability: number;
  energy: number;
  valence: number;
  acousticness: number;
  instrumentalness: number;
  tempo: number;
  mode: number;
  key: number;
}

export interface RawTrack {
  spotifyTrackId: string;
  trackName: string;
  artistName: string;
  artistId: string;
  durationMs: number;
  source: TrackSource;
}

export interface TerritoryDTO {
  id: string;
  label: string;
  status: TerritoryStatus;
  centroidVector: AudioFeatureVector;
  claimedAt: string | null;
  retreatedAt: string | null;
  createdAt: string;
  trackCount: number;
  tracks: TrackFeatureDTO[];
}

export interface TrackFeatureDTO {
  id: string;
  spotifyTrackId: string;
  trackName: string;
  artistName: string;
  genres: string[];
  mapX: number | null;
  mapY: number | null;
  territoryId: string | null;
  source: TrackSource;
}

export interface ExpeditionDTO {
  id: string;
  territoryId: string;
  territoryLabel: string;
  genres: string[];
  spotifyPlaylistId: string;
  spotifyPlaylistUrl: string;
  mock: boolean;
  trackIds: string[];
  tracks: { spotifyTrackId: string; trackName: string; artistName: string }[];
  status: ExpeditionStatus;
  completionRate: number | null;
  skipRate: number | null;
  saveCount: number | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface TerritoryEventDTO {
  id: string;
  territoryId: string;
  territoryLabel: string;
  type: TerritoryEventType;
  rationale: string;
  createdAt: string;
}
