import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { LandingCta } from "@/components/LandingCta";

export default async function Home() {
  const session = await getServerSession(authOptions);
  if (session?.user) redirect("/frontier");

  const mockMode = process.env.MOCK_MODE === "true";

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(29,185,84,0.15),transparent_45%),radial-gradient(circle_at_80%_70%,rgba(29,185,84,0.08),transparent_40%)]" />

      <header className="relative z-10 flex items-center justify-between px-8 py-6 sm:px-16">
        <div className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <span className="h-2.5 w-2.5 rounded-full bg-accent" />
          Frontier
        </div>
        {mockMode && (
          <span className="rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted">
            Demo Mode
          </span>
        )}
      </header>

      <main className="relative z-10 mx-auto flex max-w-3xl flex-1 flex-col items-start justify-center px-8 py-16 sm:px-16">
        <h1 className="text-balance text-5xl font-semibold leading-tight tracking-tight sm:text-6xl">
          Your taste has edges.
          <br />
          <span className="text-accent">Frontier scouts them.</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted">
          Every week, Frontier sends a small expedition into music adjacent to what you already
          love — then watches what you actually do with it. Tracks you embrace get claimed onto
          your map permanently. Tracks that miss get retreated from, for good.
        </p>

        <div className="mt-10">
          <LandingCta mockMode={mockMode} />
        </div>

        <dl className="mt-20 grid grid-cols-1 gap-8 sm:grid-cols-3">
          {[
            {
              term: "Territory Map",
              desc: "A living visualization of every cluster of taste you've built, claimed, or moved on from.",
            },
            {
              term: "Weekly Expeditions",
              desc: "Real Spotify playlists seeded just past the edge of what you already know.",
            },
            {
              term: "Durable Memory",
              desc: "Claim and retreat decisions persist — Frontier never re-suggests what you've already declined.",
            },
          ].map((item) => (
            <div key={item.term}>
              <dt className="text-sm font-semibold text-accent">{item.term}</dt>
              <dd className="mt-2 text-sm text-muted">{item.desc}</dd>
            </div>
          ))}
        </dl>
      </main>
    </div>
  );
}
