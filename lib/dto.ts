import {
  ExpeditionDTO,
  TerritoryDTO,
  TerritoryEventDTO,
  TerritoryStatus,
  ExpeditionStatus,
  TerritoryEventType,
  TrackSource,
  AudioFeatureVector,
  TrackFeatureDTO,
} from "@/types";
import type { Territory, TrackFeature, Expedition, TerritoryEvent } from "@prisma/client";

export function toTrackFeatureDTO(t: TrackFeature): TrackFeatureDTO {
  return {
    id: t.id,
    spotifyTrackId: t.spotifyTrackId,
    trackName: t.trackName,
    artistName: t.artistName,
    genres: t.genres,
    mapX: t.mapX,
    mapY: t.mapY,
    territoryId: t.territoryId,
    source: t.source as TrackSource,
  };
}

export function toTerritoryDTO(t: Territory & { tracks: TrackFeature[] }): TerritoryDTO {
  return {
    id: t.id,
    label: t.label,
    status: t.status as TerritoryStatus,
    centroidVector: t.centroidVector as unknown as AudioFeatureVector,
    claimedAt: t.claimedAt?.toISOString() ?? null,
    retreatedAt: t.retreatedAt?.toISOString() ?? null,
    createdAt: t.createdAt.toISOString(),
    trackCount: t.tracks.length,
    tracks: t.tracks.map(toTrackFeatureDTO),
  };
}

export function toExpeditionDTO(
  e: Expedition & { territory: Territory; trackDetails: { spotifyTrackId: string; trackName: string; artistName: string }[] },
): ExpeditionDTO {
  const mock = e.spotifyPlaylistId.startsWith("mock-playlist-");
  return {
    id: e.id,
    territoryId: e.territoryId,
    territoryLabel: e.territory.label,
    spotifyPlaylistId: e.spotifyPlaylistId,
    spotifyPlaylistUrl: mock ? "" : `https://open.spotify.com/playlist/${e.spotifyPlaylistId}`,
    mock,
    trackIds: e.trackIds,
    tracks: e.trackDetails,
    status: e.status as ExpeditionStatus,
    completionRate: e.completionRate,
    skipRate: e.skipRate,
    saveCount: e.saveCount,
    createdAt: e.createdAt.toISOString(),
    resolvedAt: e.resolvedAt?.toISOString() ?? null,
  };
}

export function toTerritoryEventDTO(e: TerritoryEvent & { territory: Territory }): TerritoryEventDTO {
  return {
    id: e.id,
    territoryId: e.territoryId,
    territoryLabel: e.territory.label,
    type: e.type as TerritoryEventType,
    rationale: e.rationale,
    createdAt: e.createdAt.toISOString(),
  };
}
