"use client";

import { useEffect, useState } from "react";
import { TerritoryDTO, TerritoryEventDTO } from "@/types";

interface Props {
  territoryId: string;
  onClose: () => void;
  onChanged: () => void;
}

export function TerritoryDetailPanel({ territoryId, onClose, onChanged }: Props) {
  const [territory, setTerritory] = useState<TerritoryDTO | null>(null);
  const [events, setEvents] = useState<TerritoryEventDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/territories/${territoryId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load territory");
        return res.json();
      })
      .then((data) => {
        setTerritory(data.territory);
        setEvents(data.events);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [territoryId]);

  const handleRetreat = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/territories/${territoryId}/retreat`, { method: "POST" });
      if (!res.ok) throw new Error("Retreat failed");
      onChanged();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-30 flex justify-end bg-black/50" onClick={onClose}>
      <div
        className="h-full w-full max-w-md overflow-y-auto scrollbar-thin border-l border-border bg-surface p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="mb-6 text-sm text-muted hover:text-foreground">
          ← Close
        </button>

        {loading && <div className="text-sm text-muted">Loading territory…</div>}
        {error && <div className="text-sm text-danger">{error}</div>}

        {territory && (
          <>
            <div className="mb-1 flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${
                  territory.status === "claimed"
                    ? "bg-accent"
                    : territory.status === "frontier"
                      ? "bg-zinc-400"
                      : "bg-zinc-600"
                }`}
              />
              <span className="text-xs uppercase tracking-wide text-muted">{territory.status}</span>
            </div>
            <h2 className="text-2xl font-semibold">{territory.label}</h2>
            <p className="mt-1 text-sm text-muted">{territory.trackCount} tracks</p>

            <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-muted">
              {territory.claimedAt && <div>Claimed {new Date(territory.claimedAt).toLocaleDateString()}</div>}
              {territory.retreatedAt && (
                <div>Retreated {new Date(territory.retreatedAt).toLocaleDateString()}</div>
              )}
            </div>

            <div className="mt-6 flex gap-2">
              {territory.status === "claimed" && (
                <button
                  onClick={handleRetreat}
                  disabled={actionLoading}
                  className="rounded-full border border-danger/40 px-4 py-2 text-sm font-medium text-danger transition hover:bg-danger/10 disabled:opacity-50"
                >
                  {actionLoading ? "Retreating…" : "Retreat from here"}
                </button>
              )}
            </div>

            <div className="mt-8">
              <h3 className="text-sm font-semibold text-muted">Why</h3>
              <div className="mt-3 space-y-3">
                {events.length === 0 && (
                  <p className="text-sm text-muted">No claim/retreat events yet for this territory.</p>
                )}
                {events.map((e) => (
                  <div key={e.id} className="rounded-xl border border-border bg-surface-raised p-3 text-sm">
                    <p>{e.rationale}</p>
                    <p className="mt-1 text-xs text-muted">{new Date(e.createdAt).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8">
              <h3 className="text-sm font-semibold text-muted">Tracks</h3>
              <ul className="mt-3 space-y-2 text-sm">
                {territory.tracks.slice(0, 25).map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-2">
                    <span className="truncate">
                      {t.trackName} <span className="text-muted">— {t.artistName}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
