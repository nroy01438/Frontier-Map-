import Anthropic from "@anthropic-ai/sdk";
import { isMockLLM } from "@/lib/mock";
import { AudioFeatureVector } from "@/types";

// The PRD specifies a model id ("claude-sonnet-4-6") that does not correspond to a real,
// callable Anthropic model. We substitute the current equivalent-tier model and keep it
// configurable, since this call hits the live Anthropic API.
const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5";

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

async function complete(prompt: string): Promise<string> {
  const res = await getClient().messages.create({
    model: MODEL,
    max_tokens: 100,
    temperature: 0.3,
    messages: [{ role: "user", content: prompt }],
  });
  const block = res.content[0];
  return block?.type === "text" ? block.text.trim() : "";
}

export interface ClusterLabelInput {
  centroid: AudioFeatureVector;
  topGenres: string[];
  exampleTracks: { trackName: string; artistName: string }[];
}

function moodAdjective(centroid: AudioFeatureVector): string {
  if (centroid.energy >= 0.65) return centroid.valence >= 0.5 ? "Electric" : "Charged";
  if (centroid.energy <= 0.35) return centroid.valence >= 0.5 ? "Hushed" : "Moody";
  return centroid.valence >= 0.5 ? "Bright" : "Warm";
}

function titleCaseGenre(genre: string): string {
  return genre.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Function A (PRD 6.7): generate a short human-readable cluster label. */
export async function labelCluster(input: ClusterLabelInput, seedIndex = 0): Promise<string> {
  if (isMockLLM()) {
    const genre = input.topGenres[0];
    if (!genre) return `Uncharted Frequencies ${seedIndex + 1}`;
    return `${moodAdjective(input.centroid)} ${titleCaseGenre(genre)}`;
  }

  const examples = input.exampleTracks.map((t) => `${t.trackName} — ${t.artistName}`).join(", ");
  const prompt = [
    "Given these audio characteristics and example tracks, generate a short 2-4 word",
    "human-readable label for this music cluster, e.g. 'Atmospheric Folk' or 'Late-Night Lo-fi'.",
    "Respond with only the label, no explanation.",
    "",
    `Audio characteristics: ${JSON.stringify(input.centroid)}`,
    `Genre tags: ${input.topGenres.join(", ") || "none"}`,
    `Example tracks: ${examples || "none"}`,
  ].join("\n");

  const label = await complete(prompt);
  return label.replace(/^["']|["']$/g, "").slice(0, 60) || "Unnamed Territory";
}

export interface RationaleInput {
  territoryLabel: string;
  decision: "claimed" | "retreated";
  stats: {
    saveCount: number;
    completionRate: number;
    skipRate: number;
    trackCount: number;
  };
}

/** Function B (PRD 6.7): generate a claim/retreat rationale sentence. */
export async function generateRationale(input: RationaleInput): Promise<string> {
  if (isMockLLM()) {
    const { territoryLabel, decision, stats } = input;
    if (decision === "claimed") {
      return `Claimed: ${territoryLabel} — you saved ${stats.saveCount} track${stats.saveCount === 1 ? "" : "s"} and finished ${Math.round(stats.completionRate * stats.trackCount)} of ${stats.trackCount} scouted tracks.`;
    }
    return `Retreated: ${territoryLabel} — skipped quickly across the expedition, with no saves.`;
  }

  const prompt = [
    "Write one short, warm, first-person-from-Spotify sentence explaining this decision to the user,",
    "referencing the specific stat provided. Example style: 'Claimed: Atmospheric Folk — you saved 2 tracks",
    "and finished 4 of 5 scouted tracks.' Keep it under 25 words. Respond with only the sentence.",
    "",
    `Territory: ${input.territoryLabel}`,
    `Decision: ${input.decision}`,
    `Stats: ${JSON.stringify(input.stats)}`,
  ].join("\n");

  const rationale = await complete(prompt);
  return rationale.replace(/^["']|["']$/g, "") || `${input.decision === "claimed" ? "Claimed" : "Retreated"}: ${input.territoryLabel}.`;
}
