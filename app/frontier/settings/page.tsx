"use client";

import { useEffect, useState } from "react";
import { TerritoryDTO } from "@/types";

export default function SettingsPage() {
  const [paused, setPaused] = useState<boolean | null>(null);
  const [candidateGenres, setCandidateGenres] = useState<string[]>([]);
  const [claimedTerritories, setClaimedTerritories] = useState<TerritoryDTO[]>([]);
  const [selectedGenre, setSelectedGenre] = useState("");
  const [selectedTerritoryId, setSelectedTerritoryId] = useState("");
  const [scoutLoading, setScoutLoading] = useState(false);
  const [retreatLoading, setRetreatLoading] = useState(false);
  const [pauseLoading, setPauseLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmRetreat, setConfirmRetreat] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/settings").then((r) => r.json()),
      fetch("/api/scout").then((r) => r.json()),
      fetch("/api/territories").then((r) => r.json()),
    ]).then(([settings, scout, territories]) => {
      setPaused(settings.expeditionsPaused);
      setCandidateGenres(scout.genres ?? []);
      const claimed = (territories.territories as TerritoryDTO[]).filter((t) => t.status === "claimed");
      setClaimedTerritories(claimed);
    });
  }, []);

  const togglePause = async () => {
    if (paused === null) return;
    setPauseLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expeditionsPaused: !paused }),
      });
      if (!res.ok) throw new Error("Failed to update setting");
      const data = await res.json();
      setPaused(data.expeditionsPaused);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setPauseLoading(false);
    }
  };

  const handleSendScout = async () => {
    if (!selectedGenre) return;
    setScoutLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/scout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ genre: selectedGenre }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to send scout");
      setMessage(`Scout sent toward "${selectedGenre}".`);
      setSelectedGenre("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setScoutLoading(false);
    }
  };

  const handleRetreat = async () => {
    if (!selectedTerritoryId) return;
    setRetreatLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/territories/${selectedTerritoryId}/retreat`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to retreat");
      setMessage("Retreated from territory.");
      setClaimedTerritories((prev) => prev.filter((t) => t.id !== selectedTerritoryId));
      setSelectedTerritoryId("");
      setConfirmRetreat(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setRetreatLoading(false);
    }
  };

  return (
    <div className="max-w-xl">
      <h1 className="mb-6 text-2xl font-semibold">Settings</h1>

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

      <section className="mb-8 rounded-2xl border border-border bg-surface p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Expeditions</h2>
            <p className="mt-1 text-sm text-muted">Pause weekly scouting without losing your map.</p>
          </div>
          <button
            onClick={togglePause}
            disabled={paused === null || pauseLoading}
            className={`relative h-7 w-12 rounded-full transition ${paused ? "bg-zinc-700" : "bg-accent"} disabled:opacity-50`}
          >
            <span
              className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition ${paused ? "left-0.5" : "left-[22px]"}`}
            />
          </button>
        </div>
        <p className="mt-3 text-xs text-muted">
          {paused === null ? "Loading…" : paused ? "Expeditions are paused." : "Expeditions are active."}
        </p>
      </section>

      <section className="mb-8 rounded-2xl border border-border bg-surface p-5">
        <h2 className="font-semibold">Send a Scout</h2>
        <p className="mt-1 text-sm text-muted">
          Manually choose an adjacent, unexplored genre for Frontier to scout next.
        </p>
        <div className="mt-4 flex gap-2">
          <select
            value={selectedGenre}
            onChange={(e) => setSelectedGenre(e.target.value)}
            className="flex-1 rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm"
          >
            <option value="">Choose a genre…</option>
            {candidateGenres.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
          <button
            onClick={handleSendScout}
            disabled={!selectedGenre || scoutLoading}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-black transition hover:bg-accent/90 disabled:opacity-50"
          >
            {scoutLoading ? "Sending…" : "Send"}
          </button>
        </div>
        {candidateGenres.length === 0 && (
          <p className="mt-2 text-xs text-muted">No eligible adjacent genres right now.</p>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="font-semibold">Retreat</h2>
        <p className="mt-1 text-sm text-muted">
          Permanently suppress a claimed territory. Frontier will never scout this genre again.
        </p>
        <div className="mt-4 flex gap-2">
          <select
            value={selectedTerritoryId}
            onChange={(e) => {
              setSelectedTerritoryId(e.target.value);
              setConfirmRetreat(false);
            }}
            className="flex-1 rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm"
          >
            <option value="">Choose a territory…</option>
            {claimedTerritories.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
          {!confirmRetreat ? (
            <button
              onClick={() => setConfirmRetreat(true)}
              disabled={!selectedTerritoryId}
              className="rounded-lg border border-danger/40 px-4 py-2 text-sm font-medium text-danger transition hover:bg-danger/10 disabled:opacity-50"
            >
              Retreat
            </button>
          ) : (
            <button
              onClick={handleRetreat}
              disabled={retreatLoading}
              className="rounded-lg bg-danger px-4 py-2 text-sm font-semibold text-white transition hover:bg-danger/90 disabled:opacity-50"
            >
              {retreatLoading ? "Retreating…" : "Confirm retreat"}
            </button>
          )}
        </div>
        {claimedTerritories.length === 0 && (
          <p className="mt-2 text-xs text-muted">No claimed territories yet.</p>
        )}
      </section>
    </div>
  );
}
