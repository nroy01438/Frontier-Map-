"use client";

import { useCallback, useEffect, useState } from "react";
import { ExpeditionDTO } from "@/types";

const STATUS_STYLES: Record<string, string> = {
  active: "bg-accent/15 text-accent border-accent/30",
  claimed: "bg-accent/15 text-accent border-accent/30",
  retreated: "bg-zinc-700/40 text-zinc-400 border-zinc-700",
  inconclusive: "bg-zinc-700/20 text-zinc-500 border-zinc-800",
};

const DECISION_MESSAGE: Record<string, string> = {
  claimed: "Resolved — the territory was claimed based on strong engagement.",
  retreated: "Resolved — the territory was retreated from based on weak engagement.",
  inconclusive: "Resolved as inconclusive — not enough signal either way.",
  pending: "Not enough listening data yet to resolve — check back after more plays.",
};

export default function ExpeditionsPage() {
  const [expeditions, setExpeditions] = useState<ExpeditionDTO[] | null>(null);
  const [running, setRunning] = useState(false);
  const [polling, setPolling] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/expeditions");
      if (!res.ok) throw new Error("Failed to load expeditions");
      const data = await res.json();
      setExpeditions(data.expeditions);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleRunScout = async () => {
    setRunning(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/expeditions/run", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to run scout");
      const isMock = (data.expedition?.spotifyPlaylistId ?? "").startsWith("mock-playlist-");
      setMessage(
        isMock
          ? "New expedition launched (demo mode — no real playlist). Use \"Check Engagement\" to simulate listening, or Claim/Retreat below to decide directly."
          : "New expedition launched — check your Spotify playlists.",
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setRunning(false);
    }
  };

  const handlePoll = async () => {
    setPolling(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/expeditions/poll", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to check engagement");
      const results: string[] = data.results ?? [];
      if (results.length === 0) {
        setMessage("No active expedition to check right now.");
      } else {
        setMessage(results.map((r) => DECISION_MESSAGE[r] ?? r).join(" "));
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setPolling(false);
    }
  };

  const handleManualResolve = async (expeditionId: string, decision: "claimed" | "retreated") => {
    setResolvingId(expeditionId);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/expeditions/${expeditionId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to resolve expedition");
      setMessage(decision === "claimed" ? DECISION_MESSAGE.claimed : DECISION_MESSAGE.retreated);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Expeditions</h1>
        <div className="flex gap-2">
          <button
            onClick={handlePoll}
            disabled={polling}
            className="rounded-full border border-border px-5 py-2 text-sm font-medium transition hover:border-accent hover:text-accent disabled:opacity-50"
          >
            {polling ? "Checking…" : "Check Engagement"}
          </button>
          <button
            onClick={handleRunScout}
            disabled={running}
            className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-black transition hover:bg-accent/90 disabled:opacity-50"
          >
            {running ? "Scouting…" : "Run Scout Now"}
          </button>
        </div>
      </div>

      {message && (
        <div className="mb-4 rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent">
          {message}
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      {expeditions === null && !error && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl border border-border bg-surface" />
          ))}
        </div>
      )}

      {expeditions && expeditions.length === 0 && (
        <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-surface text-center">
          <p className="max-w-sm text-sm text-muted">
            No expeditions yet. Run a scout to send Frontier into adjacent, unexplored territory.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {expeditions?.map((e) => (
          <div key={e.id} className="rounded-2xl border border-border bg-surface p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold">{e.territoryLabel}</h2>
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[e.status]}`}
                  >
                    {e.status}
                  </span>
                  {e.status === "active" && (
                    <span
                      title="This expedition is testing a genre outside your existing territories."
                      className="rounded-full border border-accent/30 bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-accent"
                    >
                      New genre — not yet in your map
                    </span>
                  )}
                </div>
                {e.genres.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {e.genres.map((g) => (
                      <span
                        key={g}
                        className="rounded-full bg-surface-raised px-2 py-0.5 text-[11px] text-muted"
                      >
                        {g}
                      </span>
                    ))}
                  </div>
                )}
                <p className="mt-1.5 text-xs text-muted">
                  Launched {new Date(e.createdAt).toLocaleDateString()}
                  {e.resolvedAt && ` · Resolved ${new Date(e.resolvedAt).toLocaleDateString()}`}
                </p>
              </div>
              {e.mock ? (
                <span
                  title="Demo mode simulates the playlist — there's no real Spotify playlist behind it."
                  className="shrink-0 cursor-default rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted/60"
                >
                  Playlist (demo only)
                </span>
              ) : (
                <a
                  href={e.spotifyPlaylistUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted transition hover:border-accent hover:text-accent"
                >
                  Open playlist ↗
                </a>
              )}
            </div>

            <ul className="mt-4 grid grid-cols-1 gap-1 text-sm text-muted sm:grid-cols-2">
              {e.tracks.map((t) => (
                <li key={t.spotifyTrackId} className="truncate">
                  {t.trackName} — {t.artistName}
                </li>
              ))}
            </ul>

            {(e.completionRate !== null || e.skipRate !== null || e.saveCount !== null) && (
              <div className="mt-4 flex gap-6 border-t border-border pt-4 text-xs text-muted">
                {e.completionRate !== null && <span>Completion: {Math.round(e.completionRate * 100)}%</span>}
                {e.skipRate !== null && <span>Skip: {Math.round(e.skipRate * 100)}%</span>}
                {e.saveCount !== null && <span>Saves: {e.saveCount}</span>}
              </div>
            )}

            {e.status === "active" && (
              <div className="mt-4 flex items-center gap-2 border-t border-border pt-4">
                <span className="text-xs text-muted">Decide directly (manual override):</span>
                <button
                  onClick={() => handleManualResolve(e.id, "claimed")}
                  disabled={resolvingId === e.id}
                  className="rounded-full border border-accent/40 px-3 py-1 text-xs font-medium text-accent transition hover:bg-accent/10 disabled:opacity-50"
                >
                  {resolvingId === e.id ? "…" : "Claim"}
                </button>
                <button
                  onClick={() => handleManualResolve(e.id, "retreated")}
                  disabled={resolvingId === e.id}
                  className="rounded-full border border-danger/40 px-3 py-1 text-xs font-medium text-danger transition hover:bg-danger/10 disabled:opacity-50"
                >
                  {resolvingId === e.id ? "…" : "Retreat"}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
