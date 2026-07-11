import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { AssetMeta, Asset, AssetRegistry } from "./Assets";
import { now } from "./Core";

export type LoaderEvent = {
  assetId: string;
  phase: "queued" | "downloading" | "parsing" | "ready" | "error";
  progress: number; // 0..1
  elapsedMs: number;
  error?: string;
};

export type LoaderCallback = (ev: LoaderEvent) => void;

export class AssetLoader {
  private gltf: GLTFLoader;
  private draco: DRACOLoader;
  private listeners = new Set<LoaderCallback>();

  constructor(registry: AssetRegistry) {
    this.registry = registry;
    this.draco = new DRACOLoader();
    this.draco.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.7/");

    this.gltf = new GLTFLoader();
    this.gltf.setDRACOLoader(this.draco);
  }

  readonly registry: AssetRegistry;

  on(fn: LoaderCallback) { this.listeners.add(fn); return () => this.listeners.delete(fn); }

  private emit(ev: LoaderEvent) { this.listeners.forEach(fn => fn(ev)); }

  async loadGLTF(url: string, meta: AssetMeta): Promise<Asset | null> {
    const t0 = now();
    this.emit({ assetId: meta.id, phase: "queued", progress: 0, elapsedMs: 0 });

    try {
      this.emit({ assetId: meta.id, phase: "downloading", progress: 0.1, elapsedMs: now() - t0 });

      const gltf = await this.gltf.loadAsync(url, (p) => {
        this.emit({ assetId: meta.id, phase: "downloading", progress: 0.1 + p.loaded / p.total * 0.5, elapsedMs: now() - t0 });
      });

      this.emit({ assetId: meta.id, phase: "parsing", progress: 0.65, elapsedMs: now() - t0 });

      // Walk the scene and collect mesh stats
      let meshCount = 0, vertexCount = 0, materialCount = 0;
      gltf.scene.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          meshCount++;
          materialCount += Array.isArray(child.material) ? child.material.length : 1;
          if (child.geometry) {
            vertexCount += child.geometry.attributes.position?.count ?? 0;
          }
        }
      });

      // Refine confidence based on actual loaded data
      const refinedMeta: AssetMeta = {
        ...meta,
        complexity: Math.min(1, (vertexCount / 500_000) * 0.6 + (materialCount / 50) * 0.4),
        sizeBytes: vertexCount * 32 + materialCount * 2048, // rough estimate
      };

      const asset = this.registry.add(refinedMeta, gltf.scene);
      asset.object.animations = gltf.animations;
      asset.object.userData.__gltfRaw = gltf;

      this.emit({ assetId: meta.id, phase: "ready", progress: 1, elapsedMs: now() - t0 });
      return asset;
    } catch (err: any) {
      this.emit({ assetId: meta.id, phase: "error", progress: 0, elapsedMs: now() - t0, error: err.message ?? String(err) });
      return null;
    }
  }

  async loadMultiple(jobs: { url: string; meta: AssetMeta }[]): Promise<(Asset | null)[]> {
    return Promise.all(jobs.map(j => this.loadGLTF(j.url, j.meta)));
  }
}