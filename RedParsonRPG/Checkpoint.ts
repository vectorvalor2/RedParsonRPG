import * as THREE from "three";
import { UUID, uuid, now } from "./Core";

/** A snapshot of a single object's transform at a point in time */
export type TransformSnapshot = {
  id: UUID;
  objectId: UUID;
  position: [number, number, number];
  rotation: [number, number, number]; // euler
  scale: [number, number, number];
  visible: boolean;
  timestamp: number;
};

/** A full scene checkpoint (undo/redo stack entry) */
export type Checkpoint = {
  id: UUID;
  label: string;
  timestamp: number;
  snapshots: TransformSnapshot[];
  /** Optional: serialized extra state (material overrides, wireframe, etc.) */
  extras?: Record<string, unknown>;
};

export class CheckpointStack {
  private undoStack: Checkpoint[] = [];
  private redoStack: Checkpoint[] = [];
  private maxDepth: number;
  private objectMap = new Map<UUID, THREE.Object3D>();

  constructor(maxDepth = 64) {
    this.maxDepth = maxDepth;
  }

  /** Register an object so checkpoints can track it */
  register(obj: THREE.Object3D, id?: UUID) {
    const oid = id ?? (obj.userData.__oid as UUID) ?? uuid();
    obj.userData.__oid = oid;
    this.objectMap.set(oid, obj);
    return oid;
  }

  unregister(id: UUID) { this.objectMap.delete(id); }
  getObject(id: UUID) { return this.objectMap.get(id); }

  /** Take a snapshot of all registered objects */
  snapshot(label: string): Checkpoint {
    const snapshots: TransformSnapshot[] = [];
    for (const [oid, obj] of this.objectMap) {
      snapshots.push({
        id: uuid(),
        objectId: oid,
        position: [obj.position.x, obj.position.y, obj.position.z],
        rotation: [obj.rotation.x, obj.rotation.y, obj.rotation.z],
        scale: [obj.scale.x, obj.scale.y, obj.scale.z],
        visible: obj.visible,
        timestamp: now(),
      });
    }
    const cp: Checkpoint = { id: uuid(), label, timestamp: now(), snapshots };
    this.undoStack.push(cp);
    this.redoStack = []; // clear redo on new action
    if (this.undoStack.length > this.maxDepth) this.undoStack.shift();
    return cp;
  }

  /** Restore a checkpoint (applies transforms to all objects) */
  restore(cp: Checkpoint): boolean {
    for (const snap of cp.snapshots) {
      const obj = this.objectMap.get(snap.objectId);
      if (!obj) continue;
      obj.position.set(...snap.position);
      obj.rotation.set(...snap.rotation);
      obj.scale.set(...snap.scale);
      obj.visible = snap.visible;
    }
    return true;
  }

  undo(): Checkpoint | null {
    if (this.undoStack.length === 0) return null;
    // Save current state to redo first
    const current = this.snapshot("__autosave");
    this.undoStack.pop(); // remove the autosave we just made
    const cp = this.undoStack.pop()!;
    this.redoStack.push(current);
    this.restore(cp);
    return cp;
  }

  redo(): Checkpoint | null {
    if (this.redoStack.length === 0) return null;
    const current = this.snapshot("__autosave");
    this.undoStack.pop();
    const cp = this.redoStack.pop()!;
    this.undoStack.push(current);
    this.restore(cp);
    return cp;
  }

  canUndo() { return this.undoStack.length > 0; }
  canRedo() { return this.redoStack.length > 0; }

  /** List checkpoint labels for UI */
  undoList(): string[] { return this.undoStack.map(c => c.label); }
  redoList(): string[] { return this.redoStack.map(c => c.label); }

  clear() { this.undoStack = []; this.redoStack = []; }

  serialize(): { undo: Checkpoint[]; redo: Checkpoint[] } {
    return { undo: [...this.undoStack], redo: [...this.redoStack] };
  }

  deserialize(data: { undo: Checkpoint[]; redo: Checkpoint[] }) {
    this.undoStack = data.undo ?? [];
    this.redoStack = data.redo ?? [];
  }
}