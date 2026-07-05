const LOOP_STEPS = [
  {
    title: "Map",
    body: "Frontier clusters your listening history (or, in demo mode, a simulated one) into named taste territories using real audio characteristics — danceability, energy, mood, and more.",
  },
  {
    title: "Scout",
    body: "It picks one genre just outside your map — adjacent to something you like, but unexplored — and builds a 5-track expedition playlist to test it.",
  },
  {
    title: "Engage",
    body: "It watches what you actually do with that playlist: did you finish the tracks, skip them, or save any?",
  },
  {
    title: "Decide",
    body: "Strong engagement gets that territory claimed — added to your map for good. Weak engagement gets it retreated from — and Frontier promises never to suggest that genre again.",
  },
  {
    title: "Explain",
    body: "Either way, Frontier writes a one-line, plain-English reason for the decision.",
  },
  {
    title: "Update",
    body: "The map redraws itself — a new territory appears, colored by its outcome.",
  },
];

const TEST_STEPS = [
  {
    title: "Log in",
    body: 'Click "Continue in Demo Mode" on the landing page. There\'s no real account behind this — it\'s a stand-in for "Connect with Spotify" so anyone can try the product without a Spotify Developer allow-list.',
  },
  {
    title: "Build the map",
    body: 'Go to Map → click "Sync listening data." This clusters a simulated listening history into your first set of taste territories — each colored blob is a genre cluster.',
  },
  {
    title: "Click around the map",
    body: "Click any dot or territory label to open its detail panel: track list, claim/retreat date, and a manual \"Retreat from here\" option.",
  },
  {
    title: "Launch an expedition",
    body: 'Go to Expeditions → click "Run Scout Now." A new expedition appears, tagged with the genres it\'s testing and a "New genre — not yet in your map" badge.',
  },
  {
    title: "Resolve it",
    body: 'Use the "Claim" / "Retreat" buttons on the expedition card to decide its outcome directly, or click "Check Engagement" to let Frontier simulate listening behavior and decide on its own.',
  },
  {
    title: "Read the reasoning",
    body: "Go to Events to see the plain-English explanation Frontier generated for that decision.",
  },
  {
    title: "See the map update",
    body: "Go back to Map — the resolved territory now shows up there, colored according to claimed or retreated.",
  },
  {
    title: "Try manual control",
    body: 'Go to Settings to manually "Send a Scout" toward a specific genre, "Retreat" from a claimed territory, or pause/resume expeditions entirely.',
  },
];

export default function GuidePage() {
  return (
    <div className="max-w-3xl space-y-12">
      <div>
        <h1 className="text-2xl font-semibold">How Frontier works</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Spotify&rsquo;s algorithmic recommendations feel like a black box — you never know why
          something was suggested, and it never remembers if you hated it. Frontier makes that
          process visible and permanent: it builds a map of your taste, sends small expeditions
          into music just outside it, and durably claims or retreats from what it finds based on
          how you actually respond.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          This is not a chatbot. AI (Claude) is used for exactly two narrow jobs — naming taste
          clusters and writing the one-line decision explanations. Everything else — clustering,
          picking what to scout, deciding claim vs. retreat — is deterministic, rule-based logic,
          not the model guessing.
        </p>
      </div>

      <div>
        <h2 className="text-lg font-semibold">The loop</h2>
        <div className="mt-4 space-y-3">
          {LOOP_STEPS.map((step, i) => (
            <div key={step.title} className="flex gap-4 rounded-2xl border border-border bg-surface p-4">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-semibold text-accent">
                {i + 1}
              </div>
              <div>
                <h3 className="text-sm font-semibold">{step.title}</h3>
                <p className="mt-1 text-sm text-muted">{step.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold">Try it yourself</h2>
        <p className="mt-2 text-sm text-muted">
          This deployment runs in Demo Mode: all data is simulated, so you can run through the
          entire loop in a couple of minutes without a real Spotify account.
        </p>
        <ol className="mt-4 space-y-3">
          {TEST_STEPS.map((step, i) => (
            <li key={step.title} className="flex gap-4 rounded-2xl border border-border bg-surface p-4">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-raised text-xs font-semibold">
                {i + 1}
              </div>
              <div>
                <h3 className="text-sm font-semibold">{step.title}</h3>
                <p className="mt-1 text-sm text-muted">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="rounded-2xl border border-accent/30 bg-accent/10 p-4 text-sm text-accent">
        Note: in Demo Mode, expedition &ldquo;playlists&rdquo; are simulated — you&rsquo;ll see
        them labeled <span className="font-medium">&ldquo;Playlist (demo only)&rdquo;</span>{" "}
        instead of a real Spotify link. In production, these are real playlists created in the
        user&rsquo;s own Spotify account.
      </div>
    </div>
  );
}
