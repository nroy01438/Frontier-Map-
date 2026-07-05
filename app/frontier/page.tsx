"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { TerritoryMap } from "@/components/TerritoryMap";
import { TerritoryDetailPanel } from "@/components/TerritoryDetailPanel";
import { TerritoryDTO } from "@/types";

export default function FrontierMapPage() {
  const searchParams = useSearchParams();
  const [territories, setTerritories] = useState<TerritoryDTO[] | null>(null);
  const [activeExpeditionCount, setActiveExpeditionCount] = useState(0);
  const [selectedTerritoryId, setSelectedTerritoryId] = useState<string | null>(
    searchParams.get("territory"),
  );
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTerritories = useCallback(async () => {
    setError(null);
    try {
      const [territoriesRes, expeditionsRes] = await Promise.all([
        fetch("/api/territories"),
        fetch("/api/expeditions"),
      ]);
      if (!territoriesRes.ok) throw new Error("Failed to load your territory map");
      const territoriesData = await territoriesRes.json();
      setTerritories(territoriesData.territories);

      if (expeditionsRes.ok) {
        const expeditionsData = await expeditionsRes.json();
        setActiveExpeditionCount(
          expeditionsData.expeditions.filter((e: { status: string }) => e.status === "active").length,
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    }
  }, []);

  useEffect(() => {
    loadTerritories();
  }, [loadTerritories]);

  const handleSync = async () => {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch("/api/ingest", { method: "POST" });
      if (!res.ok) throw new Error("Sync failed");
      await loadTerritories();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3 rounded-full border border-border bg-surface px-4 py-2">
          <span className="h-2 w-2 rounded-full bg-accent" />
          <span className="text-sm text-muted">
            {activeExpeditionCount} active expedition{activeExpeditionCount === 1 ? "" : "s"} this week
          </span>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="rounded-full border border-border px-4 py-2 text-sm font-medium transition hover:border-accent hover:text-accent disabled:opacity-50"
        >
          {syncing ? "Syncing…" : "Sync listening data"}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      {territories === null && !error && <MapSkeleton />}

      {territories && territories.length === 0 && (
        <EmptyState onSync={handleSync} syncing={syncing} />
      )}

      {territories && territories.length > 0 && (
        <TerritoryMap
          territories={territories}
          selectedTerritoryId={selectedTerritoryId}
          onSelectTerritory={setSelectedTerritoryId}
        />
      )}

      <Legend />

      {selectedTerritoryId && (
        <TerritoryDetailPanel
          territoryId={selectedTerritoryId}
          onClose={() => setSelectedTerritoryId(null)}
          onChanged={loadTerritories}
        />
      )}
    </div>
  );
}

function MapSkeleton() {
  return (
    <div className="h-[560px] w-full animate-pulse rounded-2xl border border-border bg-surface" />
  );
}

function EmptyState({ onSync, syncing }: { onSync: () => void; syncing: boolean }) {
  return (
    <div className="flex h-[560px] flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border bg-surface text-center">
      <p className="max-w-sm text-sm text-muted">
        Frontier hasn&rsquo;t mapped your taste yet. Sync your listening data to build your first
        territory map.
      </p>
      <button
        onClick={onSync}
        disabled={syncing}
        className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-black transition hover:bg-accent/90 disabled:opacity-50"
      >
        {syncing ? "Syncing…" : "Sync listening data"}
      </button>
    </div>
  );
}

function Legend() {
  return (
    <div className="mt-4 flex items-center gap-6 text-xs text-muted">
      <span className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-accent" /> Claimed
      </span>
      <span className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-zinc-400" /> Frontier
      </span>
      <span className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-zinc-600" /> Retreated
      </span>
    </div>
  );
}
