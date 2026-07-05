import { kmeans } from "ml-kmeans";
import { PCA } from "ml-pca";
import { AudioFeatureVector } from "@/types";

export const FEATURE_ORDER: (keyof AudioFeatureVector)[] = [
  "danceability",
  "energy",
  "valence",
  "acousticness",
  "instrumentalness",
  "tempo",
  "mode",
  "key",
];

/** Per PRD 6.2: tempo normalized /250 (clipped), key normalized /11. */
export function toFeatureVector(f: AudioFeatureVector): number[] {
  return [
    f.danceability,
    f.energy,
    f.valence,
    f.acousticness,
    f.instrumentalness,
    Math.min(1, f.tempo / 250),
    f.mode,
    f.key / 11,
  ];
}

export function fromFeatureVector(v: number[]): AudioFeatureVector {
  return {
    danceability: v[0],
    energy: v[1],
    valence: v[2],
    acousticness: v[3],
    instrumentalness: v[4],
    tempo: v[5] * 250,
    mode: v[6],
    key: v[7] * 11,
  };
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export interface ClusterResult {
  clusterIndex: number;
  centroid: number[];
}

/**
 * Runs k-means over track feature vectors per PRD 6.2. k defaults to 8, but is
 * reduced proportionally for small libraries (k = max(3, floor(trackCount / 8))).
 */
export function clusterTracks(vectors: number[][]): ClusterResult[] {
  const trackCount = vectors.length;
  if (trackCount === 0) return [];

  let k = 8;
  if (trackCount < 40) {
    k = Math.max(3, Math.floor(trackCount / 8));
  }
  k = Math.min(k, trackCount);

  if (k <= 1) {
    const centroid = meanVector(vectors);
    return vectors.map(() => ({ clusterIndex: 0, centroid }));
  }

  const result = kmeans(vectors, k, { seed: 42 });
  const centroids = result.centroids;
  return result.clusters.map((clusterIndex: number) => ({
    clusterIndex,
    centroid: centroids[clusterIndex],
  }));
}

function meanVector(vectors: number[][]): number[] {
  const dims = vectors[0].length;
  const sums = new Array(dims).fill(0);
  for (const v of vectors) {
    for (let i = 0; i < dims; i++) sums[i] += v[i];
  }
  return sums.map((s) => s / vectors.length);
}

/** Project feature vectors to 2D via PCA for map rendering (PRD 6.3). */
export function projectTo2D(vectors: number[][]): { x: number; y: number }[] {
  if (vectors.length < 2) {
    return vectors.map(() => ({ x: 0, y: 0 }));
  }
  const pca = new PCA(vectors);
  const projected = pca.predict(vectors, { nComponents: 2 }).to2DArray();
  return projected.map((p) => ({ x: p[0] ?? 0, y: p[1] ?? 0 }));
}

/** Threshold from PRD 6.2 step 2: match a new cluster centroid to an existing territory. */
export const TERRITORY_MATCH_THRESHOLD = 0.9;

/** Simple moving average update for a territory centroid absorbing a new cluster's centroid. */
export function movingAverageCentroid(existing: number[], incoming: number[], existingWeight: number): number[] {
  const totalWeight = existingWeight + 1;
  return existing.map((v, i) => (v * existingWeight + incoming[i]) / totalWeight);
}

export function topGenres(genreLists: string[][], topN = 3): string[] {
  const counts = new Map<string, number>();
  for (const genres of genreLists) {
    for (const g of genres) counts.set(g, (counts.get(g) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([g]) => g);
}
