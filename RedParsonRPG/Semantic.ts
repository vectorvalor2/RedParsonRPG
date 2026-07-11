import { UUID, clamp, uuid } from "./Core";

/** A semantic tag — e.g. "socket:seat", "plug:leg", "surface:table" */
export type SemanticTag = {
  id: UUID;
  kind: "socket" | "plug" | "surface" | "anchor" | "volume" | "trigger";
  label: string; // e.g. "seat", "leg-top", "table-top", "doorway"
  confidence: number; // 0..1 — how certain we are about this tag
  metadata?: Record<string, unknown>;
};

/** A rule that governs which tag kinds can interlink and under what constraints */
export type InterlinkRule = {
  name: string;
  match: { kind: "socket" | "plug" | "surface" | "anchor" | "volume" | "trigger"; label?: string };
  against: { kind: "socket" | "plug" | "surface" | "anchor" | "volume" | "trigger"; label?: string };
  /** Must be ≥ threshold for the link to be valid */
  minCombinedConfidence: number;
  /** Optional transform constraints (relative rotation, offset snap) */
  constraints?: {
    snapAxis?: "x" | "y" | "z" | "-x" | "-y" | "-z";
    angleSnap?: number; // degrees, 0 = free
    maxOffset?: number;
  };
};

export const DEFAULT_RULES: InterlinkRule[] = [
  {
    name: "plug-into-socket",
    match: { kind: "plug" },
    against: { kind: "socket" },
    minCombinedConfidence: 0.6,
    constraints: { snapAxis: "y", maxOffset: 0.15 },
  },
  {
    name: "surface-to-surface",
    match: { kind: "surface" },
    against: { kind: "surface" },
    minCombinedConfidence: 0.5,
    constraints: { snapAxis: "y", angleSnap: 90, maxOffset: 0.25 },
  },
  {
    name: "anchor-to-anchor",
    match: { kind: "anchor" },
    against: { kind: "anchor" },
    minCombinedConfidence: 0.5,
    constraints: { maxOffset: 0.5 },
  },
  {
    name: "volume-contains",
    match: { kind: "volume" },
    against: { kind: "volume" },
    minCombinedConfidence: 0.55,
    constraints: { maxOffset: 2.0 },
  },
];

export type SemanticLink = {
  id: UUID;
  rule: string; // InterlinkRule.name
  source: UUID; // SemanticTag.id
  target: UUID; // SemanticTag.id
  combinedConfidence: number;
  createdAt: number;
};

export class SemanticGraph {
  tags = new Map<UUID, SemanticTag>();
  links = new Map<UUID, SemanticLink>();
  rules: InterlinkRule[] = [...DEFAULT_RULES];

  addTag(tag: SemanticTag) { this.tags.set(tag.id, tag); return tag; }
  getTag(id: UUID) { return this.tags.get(id); }

  addRule(rule: InterlinkRule) { this.rules.push(rule); }

  /** Find all tags that could link with `tag` under the current rule set */
  findCandidates(tag: SemanticTag): { candidate: SemanticTag; rule: InterlinkRule; combinedConfidence: number }[] {
    const results: { candidate: SemanticTag; rule: InterlinkRule; combinedConfidence: number }[] = [];

    for (const rule of this.rules) {
      // Determine which role `tag` plays
      const asSource = rule.match.kind === tag.kind && (!rule.match.label || rule.match.label === tag.label);
      const asTarget = rule.against.kind === tag.kind && (!rule.against.label || rule.against.label === tag.label);

      if (!asSource && !asTarget) continue;

      for (const [, other] of this.tags) {
        if (other.id === tag.id) continue;
        if (asSource && rule.against.kind === other.kind && (!rule.against.label || rule.against.label === other.label)) {
          const combined = (tag.confidence + other.confidence) / 2;
          if (combined >= rule.minCombinedConfidence) {
            results.push({ candidate: other, rule, combinedConfidence: combined });
          }
        }
        if (asTarget && rule.match.kind === other.kind && (!rule.match.label || rule.match.label === other.label)) {
          const combined = (tag.confidence + other.confidence) / 2;
          if (combined >= rule.minCombinedConfidence) {
            results.push({ candidate: other, rule, combinedConfidence: combined });
          }
        }
      }
    }
    return results;
  }

  link(source: UUID, target: UUID, ruleName: string): SemanticLink | null {
    const src = this.tags.get(source);
    const tgt = this.tags.get(target);
    if (!src || !tgt) return null;
    const rule = this.rules.find(r => r.name === ruleName);
    if (!rule) return null;
    const combined = (src.confidence + tgt.confidence) / 2;
    if (combined < rule.minCombinedConfidence) return null;

    const link: SemanticLink = {
      id: uuid(), rule: ruleName, source, target,
      combinedConfidence: combined, createdAt: Date.now(),
    };
    this.links.set(link.id, link);
    return link;
  }

  /** Produce a risk score for the whole semantic graph (0 = safe, 1 = dangerous) */
  riskScore(): number {
    if (this.tags.size === 0) return 0;
    let totalConf = 0;
    for (const [, t] of this.tags) totalConf += t.confidence;
    const avgTagConf = totalConf / this.tags.size;

    let linkedCount = 0;
    for (const [, l] of this.links) {
      if (l.combinedConfidence >= 0.6) linkedCount++;
    }
    const linkRatio = this.tags.size > 1 ? linkedCount / (this.tags.size - 1) : 0;

    return clamp(1 - (avgTagConf * 0.6 + linkRatio * 0.4), 0, 1);
  }
}