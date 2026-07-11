import * as THREE from "three";
import { SGNode, SceneGraph } from "./SceneGraph";
import { SafetyLayer } from "./Safety";
import { PhysicsLayer } from "./Physics";
import { RenderLayer } from "./Renderer";
import { AssetRegistry, Asset } from "./Assets";
import { golden } from "./Core";

export class MapLayer {
  node: SGNode;
  constructor(graph: SceneGraph) {
    this.node = new SGNode("Group", new THREE.Group());
    this.node.name = "MapLayer";
    graph.root.add(this.node);
  }

  addGround(size = 40) {
    const geo = new THREE.PlaneGeometry(size, size);
    const mat = new THREE.MeshStandardMaterial({ color: 0x1c1f26, metalness: 0.1, roughness: 0.9 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.receiveShadow = true;
    this.node.object.add(mesh);
    return mesh;
  }

  addLight() {
    const light = new THREE.DirectionalLight(0xffffff, 1.2);
    light.position.set(golden(2), golden(1), golden(3));
    light.castShadow = true;
    this.node.object.add(light);
    const amb = new THREE.AmbientLight(0x404040, 0.6);
    this.node.object.add(amb);
    return { light, amb };
  }
}

export class TransformLayer {
  applyGoldenLayout(objects: THREE.Object3D[]) {
    const g = golden(1);
    objects.forEach((o, i) => {
      const r = i + 1;
      const angle = r * 137.5 * (Math.PI / 180); // sunflower spiral
      const radius = g * Math.sqrt(r) * 0.6;
      o.position.set(Math.cos(angle) * radius, 0.5 + (i % 3) * 0.25, Math.sin(angle) * radius);
      o.rotation.y = angle;
    });
  }
}

export class RenderPipeline {
  graph: SceneGraph;
  safety: SafetyLayer;
  physics: PhysicsLayer;
  assets: AssetRegistry;
  map: MapLayer;
  transforms: TransformLayer;
  renderer: RenderLayer;

  constructor(container: HTMLElement) {
    this.graph = new SceneGraph();
    this.safety = new SafetyLayer();
    this.physics = new PhysicsLayer();
    this.assets = new AssetRegistry();
    this.map = new MapLayer(this.graph);
    this.transforms = new TransformLayer();
    this.renderer = new RenderLayer(container);
  }

  promote(asset: Asset) {
    // gate by safety
    if (!this.safety.canPromote(asset)) return false;
    this.graph.scene.add(asset.object);
    // add debug shell and wireframe overlay cues
    const bounds = this.safety.drawDebugBounds(asset.object, 0x2dd4bf);
    this.graph.scene.add(bounds);
    return true;
  }
}
