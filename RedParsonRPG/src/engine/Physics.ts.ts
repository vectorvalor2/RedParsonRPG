import * as THREE from "three";
import { clamp, DEFAULT_SAFE } from "./Core";

export type Body = {
  object: THREE.Object3D;
  velocity: THREE.Vector3;
  mass: number;
  restitution: number; // 0..1
};

export class PhysicsLayer {
  bodies: Body[] = [];
  gravity = new THREE.Vector3(0, -9.81, 0);

  addBody(body: Body) {
    this.bodies.push(body);
  }

  step(dt: number) {
    for (const b of this.bodies) {
      // semi-implicit Euler
      b.velocity.addScaledVector(this.gravity, dt);
      b.object.position.addScaledVector(b.velocity, dt);

      // simple ground plane collision at y=0
      if (b.object.position.y < 0) {
        b.object.position.y = 0;
        b.velocity.y = Math.abs(b.velocity.y) * b.restitution;
      }

      // energy cap (safety)
      const speed2 = b.velocity.lengthSq();
      const maxV = Math.sqrt(DEFAULT_SAFE.physicsMaxEnergy / Math.max(0.001, b.mass));
      const maxV2 = maxV * maxV;
      if (speed2 > maxV2) {
        b.velocity.multiplyScalar(clamp(maxV / Math.sqrt(speed2), 0, 1));
      }
    }
  }
}
