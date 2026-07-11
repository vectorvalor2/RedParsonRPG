import { UUID, uuid, now } from "./Core";
import { SemanticTag, SemanticGraph, InterlinkRule } from "./Semantic";
import { Asset } from "./Assets";
import * as THREE from "three";

export type RiskLevel = "low" | "medium" | "high" | "critical";

export type SafetyReport = {
  overallRisk: RiskLevel;
  score: number; // 0..1, higher = safer
  assetRisks: { assetId: string; risk: RiskLevel; factors: string[] }[];
  semanticRisk: number;
  recommendations: string[];
};

export class SafetyLayer {
  cfg = {
    minConfidence: 0.62,
    physicsMaxEnergy: 2500,
    audioMaxDb: -6,
    maxSceneTriangles: 2_000_000,
    maxDrawCalls: 2000,
  };

  private semantics: SemanticGraph;

  constructor(semantics: SemanticGraph) {
    this.semantics = semantics;
  }

  risk(asset: Asset): RiskLevel {
    const s = asset.confidence.score;
    if (s >= this.cfg.minConfidence) return "low";
    if (s >= this.cfg.minConfidence * 0.85) return "medium";
    if (s >= this.cfg.minConfidence * 0.6) return "high";
    return "critical";
  }

  canPromote(asset: Asset) {
    return this.risk(asset) === "low";
  }

  /** Full scene safety audit */
  audit(assets: Asset[]): SafetyReport {
    const assetRisks: SafetyReport["assetRisks"] = [];
    let totalScore = 0;
    const recommendations: string[] = [];
    let totalTriangles = 0;
    let drawCalls = 0;

    for (const asset of assets) {
      const risk = this.risk(asset);
      const factors: string[] = [];

      if (asset.confidence.factors.provenance < 0.7) factors.push("low-provenance");
      if (asset.confidence.factors.complexity < 0.5) factors.push("high-complexity");
      if (asset.confidence.factors.flags < 0.7) factors.push("unsafe-hints");
      if (asset.confidence.factors.size < 0.5) factors.push("large-asset");

      assetRisks.push({ assetId: asset.meta.id, risk, factors });
      totalScore += asset.confidence.score;

      // Count triangles
      asset.object.traverse((child) => {
        if (child instanceof THREE.Mesh && child.geometry) {
          const idx = child.geometry.index;
          const pos = child.geometry.attributes.position;
          if (pos) {
            totalTriangles += idx ? idx.count / 3 : pos.count / 3;
          }
          drawCalls++;
        }
      });
    }

    const avgAssetScore = assets.length ? totalScore / assets.length : 0;
    const semanticRisk = this.semantics.riskScore();
    const overallScore = avgAssetScore * 0.5 + (1 - semanticRisk) * 0.3 + 0.2; // resource headroom

    if (totalTriangles > this.cfg.maxSceneTriangles) {
      recommendations.push(`Triangle count ${totalTriangles.toLocaleString()} exceeds budget of ${this.cfg.maxSceneTriangles.toLocaleString()}`);
    }
    if (drawCalls > this.cfg.maxDrawCalls) {
      recommendations.push(`Draw calls (${drawCalls}) exceed budget of ${this.cfg.maxDrawCalls}`);
    }
    if (avgAssetScore < 0.5) {
      recommendations.push("Average asset confidence is low — consider replacing or re-validating assets");
    }
    if (semanticRisk > 0.4) {
      recommendations.push("Semantic graph has unlinked or low-confidence tags — review scene structure");
    }

    let overallRisk: RiskLevel = "low";
    if (overallScore < 0.4) overallRisk = "critical";
    else if (overallScore < 0.55) overallRisk = "high";
    else if (overallScore < 0.7) overallRisk = "medium";

    return { overallRisk, score: overallScore, assetRisks, semanticRisk, recommendations };
  }

  drawDebugBounds(obj: THREE.Object3D, color = 0xff2d55): THREE.LineSegments {
    const box = new THREE.Box3().setFromObject(obj);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size); box.getCenter(center);

    const geo = new THREE.BoxGeometry(size.x, size.y, size.z);
    const edges = new THREE.EdgesGeometry(geo);
    const mat = new THREE.LineBasicMaterial({ color });
    const lines = new THREE.LineSegments(edges, mat);
    lines.position.copy(center);
    lines.userData.__safeBounds = true;
    return lines;
  }

  /** Color-code debug bounds by risk level */
  boundsColor(risk: RiskLevel): number {
    switch (risk) {
      case "low": return 0x2dd4bf;     // teal
      case "medium": return 0xffd166;  // amber
      case "high": return 0xff8c42;    // orange
      case "critical": return 0xff2d55; // red
    }
  }
}