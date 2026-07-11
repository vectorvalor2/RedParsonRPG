export type UUID = string;
export const now = () => performance.now();

export type ConfidenceScore = {
  id: UUID;
  factors: Record<string, number>; // 0..1 per factor
  score: number; // weighted 0..1
  updatedAt: number;
};

export type RiskLevel = "low" | "medium" | "high";

export type SafeConfig = {
  minConfidence: number; // threshold to promote to active viewport
  physicsMaxEnergy: number; // cap to avoid explosive sims
  audioMaxDb: number; // soft ceiling in dBFS
};

export const DEFAULT_SAFE: SafeConfig = {
  minConfidence: 0.62,            // golden-ish gate
  physicsMaxEnergy: 2500,
  audioMaxDb: -6
};

export function golden(n = 1) {
  const phi = 1.61803398875;
  return Math.pow(phi, n);
}

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

export function uuid(): UUID {
  return crypto.randomUUID ? crypto.randomUUID() : `${Math.random()}`.slice(2);
}
