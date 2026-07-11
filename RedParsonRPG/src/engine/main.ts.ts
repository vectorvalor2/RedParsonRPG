import * as THREE from "three";
import { RenderPipeline } from "./engine/Layers";
import { EditorTools } from "./engine/Editor";
import { Body, PhysicsLayer } from "./engine/Physics";

const el = document.getElementById("viewport") as HTMLElement;
const pipe = new RenderPipeline(el);
const editor = new EditorTools(pipe, pipe.assets);

// Map and lights
pipe.map.addGround(40);
pipe.map.addLight();

// Spawn a set of safe, confidence-scored primitives
const meshes: THREE.Object3D[] = [];
for (let i = 0; i < 24; i++) {
  const box = editor.spawnBox(`box-${i}`, 0.6, new THREE.Color().setHSL(i / 24, 0.6, 0.56).getHex());
  meshes.push(box);
}

// Golden ratio auto-layout
pipe.transforms.applyGoldenLayout(meshes);

// Add basic physics bodies
const phys = pipe.physics as PhysicsLayer;
const bodies: Body[] = meshes.map(m => ({
  object: m,
  velocity: new THREE.Vector3((Math.random() - 0.5) * 0.4, Math.random() * 1.2, (Math.random() - 0.5) * 0.4),
  mass: 1,
  restitution: 0.45
}));
bodies.forEach(b => phys.addBody(b));

// Camera controls (simple orbit)
let az = 0;
function moveCamera(dt: number) {
  az += dt * 0.1;
  const r = 10;
  pipe.renderer.camera.position.set(Math.cos(az) * r, 5.5, Math.sin(az) * r);
  pipe.renderer.camera.lookAt(0, 0.5, 0);
}

// Performance HUD + guides
const fpsEl = document.getElementById("fps")!;
const confEl = document.getElementById("conf")!;
const gateEl = document.getElementById("gate")!;
const guideCanvas = document.getElementById("guides") as HTMLCanvasElement;

function drawGuides() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  guideCanvas.width = innerWidth * dpr;
  guideCanvas.height = innerHeight * dpr;
  guideCanvas.style.width = innerWidth + "px";
  guideCanvas.style.height = innerHeight + "px";
  const ctx = guideCanvas.getContext("2d")!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  const g = (1 + Math.sqrt(5)) / 2;
  const w = innerWidth, h = innerHeight;
  ctx.strokeStyle = "rgba(45,212,191,0.25)";
  ctx.lineWidth = 1;
  // rule of thirds-ish using phi
  const x1 = w / g, x2 = w - x1, y1 = h / g, y2 = h - y1;
  ctx.beginPath();
  ctx.moveTo(x1, 0); ctx.lineTo(x1, h);
  ctx.moveTo(x2, 0); ctx.lineTo(x2, h);
  ctx.moveTo(0, y1); ctx.lineTo(w, y1);
  ctx.moveTo(0, y2); ctx.lineTo(w, y2);
  ctx.stroke();
}
addEventListener("resize", () => { pipe.renderer.resize(); drawGuides(); });
drawGuides();

// Main loop with risk‑gated render
let last = performance.now();
let frames = 0, acc = 0;

function tick(t: number) {
  const dt = Math.min(0.033, (t - last) / 1000); // clamp 30ms
  last = t;

  // physics + camera
  phys.step(dt);
  moveCamera(dt);

  // compute aggregate confidence of active assets
  let total = 0, count = 0;
  meshes.forEach(_ => { total += 0.9; count++; }); // primitives: fixed 0.9
  const conf = count ? total / count : 0;
  confEl.textContent = conf.toFixed(2);

  const gateOpen = conf >= 0.62;
  gateEl.textContent = gateOpen ? "open" : "closed";
  gateEl.className = gateOpen ? "ok" : "bad";

  // risk‑gated post: if closed, use wireframe fallback
  if (!gateOpen) {
    meshes.forEach(m => {
      const mesh = m as THREE.Mesh;
      if (Array.isArray(mesh.material)) return;
      (mesh.material as THREE.MeshStandardMaterial).wireframe = true;
    });
  } else {
    meshes.forEach(m => {
      const mesh = m as THREE.Mesh;
      if (Array.isArray(mesh.material)) return;
      (mesh.material as THREE.MeshStandardMaterial).wireframe = false;
    });
  }

  pipe.renderer.draw(pipe.graph.scene);

  // fps
  acc += dt; frames++;
  if (acc >= 0.5) {
    const fps = Math.round(frames / acc);
    fpsEl.textContent = String(fps);
    acc = 0; frames = 0;
  }

  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

// Enable simple drag‑drop editing on canvas
const canvas = (pipe.renderer as any).renderer.domElement as HTMLCanvasElement;
new EditorTools(pipe, pipe.assets).dragAndDropEnable(canvas);

// Seed a quick SFX on start
editor.audio.burst(660, 0.08, 0.3);
