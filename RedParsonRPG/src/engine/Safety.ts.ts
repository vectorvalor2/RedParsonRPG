import * as THREE from "three";
import { DEFAULT_SAFE, SafeConfig, RiskLevel } from "./Core";
import { Asset } from "./Assets";

export class SafetyLayer {
  cfg: SafeConfig = { ...DEFAULT_SAFE };

  risk(asset: Asset): RiskLevel {
    const s = asset.confidence.score;
    if (s >= this.cfg.minConfidence) return "low";
    if (s >= this.cfg.minConfidence * 0.85) return "medium";
    return "high";
  }

  canPromote(asset: Asset) {
    return this.risk(asset) === "low";
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
}
