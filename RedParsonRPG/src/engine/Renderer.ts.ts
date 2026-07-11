import * as THREE from "three";

export class RenderLayer {
  renderer: THREE.WebGLRenderer;
  camera: THREE.PerspectiveCamera;
  composer?: any; // slot for post later
  container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 2000);
    this.camera.position.set(6, 3, 8);
  }

  resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  draw(scene: THREE.Scene, camera?: THREE.Camera) {
    this.renderer.render(scene, camera ?? this.camera);
  }
}
