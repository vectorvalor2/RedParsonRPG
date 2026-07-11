import * as THREE from "three";
import { AssetRegistry } from "./Assets";
import { RenderPipeline } from "./Layers";
import { AudioLayer } from "./Audio";

export class EditorTools {
  audio = new AudioLayer();

  constructor(public pipe: RenderPipeline, public assets: AssetRegistry) {}

  spawnBox(id: string, size = 1, color = 0xff3b30) {
    const geo = new THREE.BoxGeometry(size, size, size);
    const mat = new THREE.MeshStandardMaterial({ color, metalness: 0.2, roughness: 0.7 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;

    const asset = this.assets.add(
      { id, tags: ["primitive", "box"], sizeBytes: 12_000, provenance: "template", complexity: 0.1 },
      mesh
    );

    this.pipe.promote(asset);
    this.audio.burst(220 + Math.random() * 110, 0.08, 0.35);
    return mesh;
  }

  dragAndDropEnable(canvas: HTMLCanvasElement) {
    let drag: THREE.Object3D | null = null;
    const ray = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onDown = (e: MouseEvent) => {
      mouse.x = (e.offsetX / canvas.clientWidth) * 2 - 1;
      mouse.y = -(e.offsetY / canvas.clientHeight) * 2 + 1;
      ray.setFromCamera(mouse, this.pipe.renderer.camera);
      const hits = ray.intersectObjects(this.pipe.graph.scene.children, true);
      if (hits.length) drag = hits[0].object;
    };
    const onMove = (e: MouseEvent) => {
      if (!drag) return;
      mouse.x = (e.offsetX / canvas.clientWidth) * 2 - 1;
      mouse.y = -(e.offsetY / canvas.clientHeight) * 2 + 1;
      ray.setFromCamera(mouse, this.pipe.renderer.camera);
      const planeY = 0.5;
      const t = - (ray.ray.origin.y - planeY) / ray.ray.direction.y;
      const pos = ray.ray.at(t, new THREE.Vector3());
      drag.position.x = pos.x; drag.position.z = pos.z;
    };
    const onUp = () => (drag = null);

    canvas.addEventListener("mousedown", onDown);
    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("mouseup", onUp);
  }
}
