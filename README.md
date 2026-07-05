# Frontier

Frontier is a Spotify-adjacent app that builds a visual "Territory Map" of a
listener's taste, sends weekly AI-scouted expeditions into adjacent, unexplored
genres as real Spotify playlists, watches how the listener actually engages
with them, and durably claims or retreats from that territory based on what it
observes. See the full product spec in the PRD this repo implements.

This is not a chatbot — the LLM (Claude) is used for exactly two narrow,
structured tasks: labeling taste clusters and writing one-sentence claim/retreat
rationales. All clustering, expedition planning, and claim/retreat decisions are
deterministic/statistical, not LLM-driven.

## Tech stack

- **Next.js 14 (App Router) + TypeScript + Tailwind CSS**
- **PostgreSQL + Prisma** — pinned to Prisma **6.x** (Prisma 7 removed the
  classic `datasource { url = env(...) }` config in favor of driver adapters +
  `prisma.config.ts`; 6.x keeps the simple setup this project uses).
- **NextAuth.js (Auth.js v4)** with the built-in Spotify OAuth provider, plus a
  `mock` Credentials provider for `MOCK_MODE`
- **D3.js** for the Territory Map visualization
- **`ml-kmeans` / `ml-pca`** for clustering and 2D map projection (no external
  embeddings API — Spotify's own Audio Features are the feature vector)
- **Anthropic Claude API** for cluster labeling + claim/retreat rationale text
- Deploys to **Vercel**, with **Vercel Cron** driving the daily/weekly jobs

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Set up Postgres

Any Postgres works (local, [Neon](https://neon.tech), [Supabase](https://supabase.com)).
For local development:

```bash
createdb frontier_dev
```

### 3. Configure environment variables

Copy the example file and fill it in:

```bash
cp .env.local.example .env.local
```

| Variable | Notes |
|---|---|
| `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` | From the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard). Not needed in `MOCK_MODE`. |
| `SPOTIFY_REDIRECT_URI` | Must match a Redirect URI registered on your Spotify app, e.g. `http://localhost:3000/api/auth/callback/spotify`. |
| `NEXTAUTH_SECRET` | Any random string (`openssl rand -base64 32`). |
| `NEXTAUTH_URL` | `http://localhost:3000` locally. |
| `DATABASE_URL` | Postgres connection string. |
| `ANTHROPIC_API_KEY` | From the [Anthropic Console](https://console.anthropic.com). Not needed if `MOCK_LLM=true`. |
| `CRON_SECRET` | Shared secret checked against the `Authorization: Bearer <secret>` header on `/api/cron/*`. Vercel Cron sends this automatically when `CRON_SECRET` is set as an env var on the project. |
| `ENCRYPTION_KEY` | Any random string — used to AES-256-GCM encrypt Spotify tokens at rest. |
| `MOCK_MODE` | `true` to bypass real Spotify OAuth entirely and run against bundled fixture data (see below). |
| `MOCK_LLM` | `true` to also bypass the real Anthropic API call, returning canned but realistic text. Implied by `MOCK_MODE=true`. |

The Prisma CLI itself only reads `.env` (not `.env.local`), so if you're running
`npx prisma ...` commands directly, also put `DATABASE_URL` in a `.env` file.

### 4. Apply the schema

```bash
npx prisma migrate deploy
```

(Local schema iteration during development uses `npm run db:migrate`
(`prisma migrate dev`) instead, which also generates new migration files.)

### 5. Run it

```bash
npm run dev
```

Visit `http://localhost:3000`.

## Deploying to Vercel (demo in ~10 minutes)

You need three things: a Vercel account, a Postgres database, and this repo
connected to both. In `MOCK_MODE`, that's it — no Spotify Developer app or
Anthropic key required to get a fully working demo URL.

1. **Create a Postgres database.** [Neon](https://neon.tech) has a free tier
   and is the fastest option: create a project, then copy the connection
   string it gives you (starts with `postgresql://...`).
2. **Import the repo into Vercel.** [vercel.com/new](https://vercel.com/new) →
   import `nroy01438/Frontier-Map-` → pick the branch you want to deploy
   (either the PR branch directly for a preview URL, or merge the PR to
   `main` first for a production URL). Framework preset should auto-detect
   as Next.js.
3. **Set environment variables** in the Vercel project's Settings →
   Environment Variables, before the first deploy if possible:
   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | the Neon connection string from step 1 |
   | `MOCK_MODE` | `true` |
   | `MOCK_LLM` | `true` |
   | `NEXTAUTH_SECRET` | output of `openssl rand -base64 32` |
   | `ENCRYPTION_KEY` | output of `openssl rand -base64 32` |
   | `CRON_SECRET` | output of `openssl rand -base64 32` |
   | `NEXTAUTH_URL` | the deployment's URL, e.g. `https://frontier-map.vercel.app` |

   `NEXTAUTH_URL` has a chicken-and-egg problem: Vercel doesn't give you the
   URL until after the first deploy. Deploy once, copy the assigned URL into
   `NEXTAUTH_URL`, then redeploy (Vercel → Deployments → ⋯ → Redeploy) — that
   second deploy is the one you actually share.
4. **Deploy.** Vercel runs `npm run build`, which is `prisma migrate deploy
   && next build` — it applies the schema to your Neon database automatically
   on every deploy, no manual migration step needed.
5. **(Optional) Vercel Cron.** `vercel.json` already declares the daily/weekly
   cron schedule; Vercel picks it up automatically on deploy and sends the
   `Authorization: Bearer $CRON_SECRET` header itself, matching what
   `/api/cron/*` checks for. Nothing else to configure.

To later upgrade the same deployment to real Spotify + real Claude: register
an app at the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
with `https://<your-vercel-url>/api/auth/callback/spotify` as a Redirect URI,
add every demo viewer's Spotify account under that app's "Users and Access"
(Spotify apps in Dev Mode cap out at 25 allow-listed users), then set
`SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REDIRECT_URI`,
`ANTHROPIC_API_KEY`, and flip `MOCK_MODE`/`MOCK_LLM` to `false`.

## Running in `MOCK_MODE`

Spotify apps in Developer Mode only allow logins from users you've explicitly
allow-listed in the Spotify dashboard — so a reviewer without dashboard access
can't just log in with their own Spotify account. Set `MOCK_MODE=true` (and
typically `MOCK_LLM=true`, unless you want to exercise the real Claude API) to
fully exercise the product without any of that:

- Login becomes a single "Continue in Demo Mode" button — no OAuth redirect.
- `lib/fixtures/mockTracks.json` (~215 tracks) stands in for real Spotify data.
  It's split into two pools:
  - **`baseline`** (4 genre clusters, ~127 tracks) — ingested immediately on
    "Sync listening data," simulating the user's existing listening history.
  - **`reserve`** (3 genre clusters, ~88 tracks) — held back as the candidate
    pool for expeditions, simulating "adjacent, unexplored" genres. Each
    reserve cluster can only be scouted once per user (by cluster name), so a
    demo account has 3 possible expeditions before candidates run out — a
    known limitation of a static fixture, not of the underlying algorithm.
- "Run Scout Now" and manual "Send a Scout" pull 5 tracks straight from the
  matching reserve cluster instead of calling Spotify's `/recommendations`,
  and create a fake `spotifyPlaylistId` instead of a real playlist.
- Engagement polling (`/api/expeditions/poll`, and the daily cron) simulates
  skip/completion/save outcomes with a PRNG seeded by the expedition's id, so
  the same expedition always resolves the same way if you poll it twice — but
  different expeditions (new ids) will vary, split roughly 50/50 toward
  "claimed" vs. "retreated" outcomes so both paths are easy to demo.

## Running cron jobs locally

`vercel.json` wires `/api/cron/daily` (ingestion + engagement polling) and
`/api/cron/weekly` (expedition planning) to Vercel Cron. To trigger them by
hand in local dev:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/daily
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/weekly
```

Or, from the UI: the Expeditions page has a "Run Scout Now" button (equivalent
to the weekly cron, for one user), and the app calls `/api/expeditions/poll`
whenever it needs fresh engagement data.

## Architecture notes

- **`lib/spotify.ts`** — thin wrapper over the Spotify Web API (top tracks,
  recently played, saved tracks, audio features, artist genres, recommendations,
  playlist creation, `tracks/contains`).
- **`lib/ingestion.ts`** — pulls a user's listening history and audio features
  into `TrackFeature` rows (PRD §6.1).
- **`lib/clustering.ts`** — k-means clustering and PCA projection helpers, plus
  the cosine-similarity territory-matching threshold (PRD §6.2/6.3).
- **`lib/territoryEngine.ts`** — re-clusters a user's listening-history tracks
  into `Territory` rows, matching against existing territories or creating new
  ones (labeled via the LLM), and recomputes the 2D map projection.
- **`lib/expeditionPlanner.ts`** — picks an adjacent, unexplored genre (durably
  excluding retreated genres), offsets target audio features from the nearest
  claimed territory's centroid, and creates a real (or mock) Spotify playlist
  + `Expedition` row (PRD §6.4).
- **`lib/engagement.ts`** — polls `recently-played` and infers completion vs.
  skip from the gap between consecutive play timestamps, since Spotify's public
  API has no skip webhook (PRD §6.5 — documented approximation, not exact).
- **`lib/decisionPolicy.ts`** — the deterministic claim/retreat rule (PRD §6.6).
- **`lib/llm.ts`** — the only two places Claude is called: cluster labeling and
  claim/retreat rationale generation (PRD §6.7).

## Known limitations / simplifications

- **Model substitution**: the PRD specifies an Anthropic model id
  (`claude-sonnet-4-6`) that isn't a real, callable model. `lib/llm.ts` uses
  `claude-sonnet-5` by default (configurable via `ANTHROPIC_MODEL`).
- **Prisma major version**: pinned to 6.x — Prisma 7's driver-adapter migration
  was out of scope for this MVP (see above).
- **Engagement heuristic**: completion is inferred from the time gap between
  consecutive `recently-played` entries, not an exact skip signal — Spotify's
  public API doesn't expose one. A track with no next timestamp in the polling
  window is conservatively treated as not-completed.
- **Frontier genre selection**: among eligible (non-excluded, non-well-represented)
  candidate genres, the implementation picks deterministically (first eligible
  genre; in mock mode, first unused reserve cluster) rather than an exhaustive
  feature-space nearest-neighbor search across all Spotify genre seeds — Spotify
  doesn't expose feature vectors per genre ahead of a `/recommendations` call,
  so "closest to an existing claimed territory" is applied via the target
  feature offset, not the genre-selection step itself.
- **One active expedition per user** (per PRD §6.4) — enforced with a `409` if
  a second expedition is requested while one is still active/unresolved.
- **`MOCK_MODE` reserve pool is finite** (3 clusters) — after all three have
  been scouted once, `/api/scout` and "Run Scout Now" will return a `422`
  ("no eligible candidate") until one is freed up by a retreat elsewhere or the
  fixture is extended.

## Testing the flow end-to-end quickly

1. `MOCK_MODE=true MOCK_LLM=true npm run dev`
2. Visit `/`, click "Continue in Demo Mode."
3. On `/frontier`, click "Sync listening data" — the map populates with
   claimed territories built from the baseline fixture.
4. Go to `/frontier/expeditions`, click "Run Scout Now" — a new frontier
   territory + expedition appears.
5. Call `POST /api/expeditions/poll` (or wait for the daily cron) — the mock
   engagement simulation resolves the expedition to `claimed` or `retreated`.
6. Check `/frontier/events` for the rationale, and `/frontier` to see the
   territory's color update on the map.
