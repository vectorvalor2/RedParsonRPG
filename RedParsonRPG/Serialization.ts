import * as THREE from "three";
import { ConfidenceScore, UUID, RiskLevel, now } from "./Core";
import { Asset, AssetMeta, AssetRegistry } from "./Assets";
import { SemanticTag, SemanticGraph } from "./Semantic";
import { Checkpoint, CheckpointStack } from "./Checkpoint";

/** A complete .red scene file format */
export type RedScene = {
  version: string;
  timestamp: number;
  meta: {
    name: string;
    author?: string;
    description?: string;
  };
  assets: RedAssetEntry[];
  semantics: RedSemanticEntry[];
  checkpoints: {
    undo: Checkpoint[];
    redo: Checkpoint[];
  };
  config: {
    minConfidence: number;
    physicsMaxEnergy: number;
    audioMaxDb: number;
  };
};

export type RedAssetEntry = {
  id: string;
  meta: AssetMeta;
  confidence: ConfidenceScore;
  transform: {
    position: [number, number, number];
    rotation: [number, number, number];
    scale: [number, number, number];
  };
  visible: boolean;
  /** If loaded from file, store the source URL */
  sourceUrl?: string;
  /** Semantic tags attached to this asset */
  tagIds: UUID[];
};

export type RedSemanticEntry = {
  id: UUID;
  kind: SemanticTag["kind"];
  label: string;
  confidence: number;
  metadata?: Record<string, unknown>;
  /** Which asset this tag belongs to */
  assetId: string;
  /** Optional world-space anchor point */
  anchor?: [number, number, number];
};

export class SceneSerializer {
  constructor(
    private registry: AssetRegistry,
    private semantics: SemanticGraph,
    private checkpoints: CheckpointStack,
  ) {}

  /** Export the full scene to a .red JSON object */
  export(name: string, author?: string, description?: string): RedScene {
    const assets: RedAssetEntry[] = [];
    for (const [id, asset] of (this.registry as any).map as Map<string, Asset>) {
      const obj = asset.object;
      assets.push({
        id,
        meta: asset.meta,
        confidence: asset.confidence,
        transform: {
          position: [obj.position.x, obj.position.y, obj.position.z],
          rotation: [obj.rotation.x, obj.rotation.y, obj.rotation.z],
          scale: [obj.scale.x, obj.scale.y, obj.scale.z],
        },
        visible: obj.visible,
        sourceUrl: obj.userData.__sourceUrl as string | undefined,
        tagIds: asset.meta.tags as unknown as UUID[] ?? [],
      });
    }

    const semantics: RedSemanticEntry[] = [];
    for (const [, tag] of this.semantics.tags) {
      semantics.push({
        id: tag.id,
        kind: tag.kind,
        label: tag.label,
        confidence: tag.confidence,
        metadata: tag.metadata,
        assetId: (tag.metadata?.assetId as string) ?? "",
        anchor: tag.metadata?.anchor as [number, number, number] | undefined,
      });
    }

    return {
      version: "1.0.0",
      timestamp: now(),
      meta: { name, author, description },
      assets,
      semantics,
      checkpoints: this.checkpoints.serialize(),
      config: {
        minConfidence: 0.62,
        physicsMaxEnergy: 2500,
        audioMaxDb: -6,
      },
    };
  }

  /** Serialize to JSON string */
  stringify(scene: RedScene, pretty = true): string {
    return JSON.stringify(scene, null, pretty ? 2 : 0);
  }

  /** Import a .red scene and rebuild the object graph */
  import(scene: RedScene): { restored: number; failed: string[] } {
    let restored = 0;
    const failed: string[] = [];

    // Restore config
    // (in a real impl, this would push to SafetyLayer)

    // Restore assets
    for (const entry of scene.assets) {
      try {
        // Rebuild a minimal object from the transform
        const group = new THREE.Group();
        group.position.set(...entry.transform.position);
        group.rotation.set(...entry.transform.rotation);
        group.scale.set(...entry.transform.scale);
        group.visible = entry.visible;
        group.userData.__sourceUrl = entry.sourceUrl;

        const asset = this.registry.add(entry.meta, group);
        asset.confidence = entry.confidence;
        restored++;
      } catch (err: any) {
        failed.push(entry.id);
      }
    }

    // Restore semantics
    for (const sem of scene.semantics) {
      this.semantics.addTag({
        id: sem.id,
        kind: sem.kind,
        label: sem.label,
        confidence: sem.confidence,
        metadata: { ...sem.metadata, assetId: sem.assetId, anchor: sem.anchor },
      });
    }

    // Restore checkpoints
    this.checkpoints.deserialize(scene.checkpoints);

    return { restored, failed };
  }
}