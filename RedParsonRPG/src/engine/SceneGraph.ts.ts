import * as THREE from "three";
import { UUID, uuid } from "./Core";

export type NodeKind = "Group" | "Mesh" | "Light" | "Camera" | "Audio";

export class SGNode {
  id: UUID = uuid();
  name = "node";
  kind: NodeKind = "Group";
  object: THREE.Object3D;
  children: SGNode[] = [];
  parent?: SGNode;

  constructor(kind: NodeKind, object?: THREE.Object3D) {
    this.kind = kind;
    this.object = object ?? new THREE.Group();
  }

  add(child: SGNode) {
    child.parent = this;
    this.children.push(child);
    this.object.add(child.object);
  }

  traverse(fn: (n: SGNode) => void) {
    fn(this);
    this.children.forEach(c => c.traverse(fn));
  }
}

export class SceneGraph {
  scene = new THREE.Scene();
  root = new SGNode("Group", this.scene);

  byId = new Map<UUID, SGNode>();

  register(node: SGNode) {
    this.byId.set(node.id, node);
  }
}
