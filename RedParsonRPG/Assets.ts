import * as THREE from "three";
import { ConfidenceScore, now } from "./Core";

export type AssetMeta = {
  id: string;
  tags: string[];
  sizeBytes: number;
  provenance: "local" | "template" | "ai" | "remote";
  complexity: number; // 0..1
  unsafeHints?: string[];
};

export type Asset = {
  meta: AssetMeta;
  object: THREE.Object3D;
  confidence: ConfidenceScore;
};

export class AssetRegistry {
  private map = new Map<string, Asset>();

  computeConfidence(meta: AssetMeta): ConfidenceScore {
    const weights = { provenance: 0.35, complexity: 0.25, size: 0.2, flags: 0.2 };
    const provMap: Record<AssetMeta["provenance"], number> = { template: 1, local: 0.85, remote: 0.7, ai: 0.65 };
    const prov = provMap[meta.provenance] ?? 0.7;
    const complexity = 1 - meta.complexity;
    const size = Math.max(0, 1 - meta.sizeBytes / 5_000_000);
    const flags = meta.unsafeHints && meta.unsafeHints.length ? 0.4 : 1;

    const score =
      prov * weights.provenance +
      complexity * weights.complexity +
      size * weights.size +
      flags * weights.flags;

    return {
      id: meta.id,
      factors: { prov, complexity, size, flags },
      score: Math.max(0, Math.min(1, score)),
      updatedAt: now(),
    };
  }

  add(meta: AssetMeta, object: THREE.Object3D): Asset {
    const confidence = this.computeConfidence(meta);
    const asset: Asset = { meta, object, confidence };
    this.map.set(meta.id, asset);
    return asset;
  }

  get(id: string) { return this.map.get(id); }
  remove(id: string) { return this.map.delete(id); }
  all(): Asset[] { return [...this.map.values()]; }
  size() { return this.map.size; }
}