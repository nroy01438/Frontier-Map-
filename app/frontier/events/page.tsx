"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TerritoryEventDTO } from "@/types";

const TYPE_LABEL: Record<string, string> = {
  claimed: "Claimed",
  retreated: "Retreated",
  manual_scout: "Manual scout",
  manual_retreat: "Manual retreat",
};

export default function EventsPage() {
  const [events, setEvents] = useState<TerritoryEventDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/events")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load events");
        return res.json();
      })
      .then((data) => setEvents(data.events))
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Events</h1>

      {error && (
        <div className="mb-4 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      {events === null && !error && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl border border-border bg-surface" />
          ))}
        </div>
      )}

      {events && events.length === 0 && (
        <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-surface text-center">
          <p className="max-w-sm text-sm text-muted">
            No claim or retreat decisions yet. They&rsquo;ll show up here once an expedition resolves.
          </p>
        </div>
      )}

      <ol className="relative space-y-4 border-l border-border pl-6">
        {events?.map((e) => (
          <li key={e.id}>
            <span
              className={`absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full ${
                e.type === "claimed" || e.type === "manual_scout" ? "bg-accent" : "bg-zinc-500"
              }`}
            />
            <div className="rounded-2xl border border-border bg-surface p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-muted">
                  {TYPE_LABEL[e.type]}
                </span>
                <span className="text-xs text-muted">{new Date(e.createdAt).toLocaleString()}</span>
              </div>
              <p className="mt-2 text-sm">{e.rationale}</p>
              <Link
                href={`/frontier?territory=${e.territoryId}`}
                className="mt-2 inline-block text-xs text-accent hover:underline"
              >
                {e.territoryLabel} →
              </Link>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
