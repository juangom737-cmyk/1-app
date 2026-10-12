import * as THREE from 'three';
import { PhysicsEngine } from './PhysicsEngine';
import { AudioService } from '../services/AudioService';

export interface CraterDecal {
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
}

export interface ShockwaveRing {
  mesh: THREE.Mesh;
  progress: number;
  maxScale: number;
  speed: number;
}

export class DestructionSystem {
  private scene: THREE.Scene;
  private physics: PhysicsEngine;
  private audio: AudioService;
  private destructionGroup: THREE.Group;

  private craters: CraterDecal[] = [];
  private maxCraters: number = 30;
  private shockwaves: ShockwaveRing[] = [];

  // Reusable impact dust particle system
  private dustCount: number = 180;
  private dustGeo: THREE.BufferGeometry;
  private dustMat: THREE.PointsMaterial;
  private dustParticles: THREE.Points;
  private dustVels: { x: number; y: number; z: number; life: number }[] = [];

  constructor(scene: THREE.Scene, physics: PhysicsEngine) {
    this.scene = scene;
    this.physics = physics;
    this.audio = AudioService.getInstance();
    this.destructionGroup = new THREE.Group();
    this.scene.add(this.destructionGroup);

    // Initialize dust particle pool
    this.dustGeo = new THREE.BufferGeometry();
    const dustPositions = new Float32Array(this.dustCount * 3);
    for (let i = 0; i < this.dustCount; i++) {
      dustPositions[i * 3] = 0;
      dustPositions[i * 3 + 1] = -100;
      dustPositions[i * 3 + 2] = 0;
      this.dustVels.push({ x: 0, y: 0, z: 0, life: 0 });
    }
    this.dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
    this.dustMat = new THREE.PointsMaterial({
      color: 0xcfd8dc,
      size: 1.8,
      transparent: true,
      opacity: 0.0,
      blending: THREE.NormalBlending,
      depthWrite: false,
    });
    this.dustParticles = new THREE.Points(this.dustGeo, this.dustMat);
    this.destructionGroup.add(this.dustParticles);
  }

  /**
   * Spawns an explosive physical impact with craters, debris shards, dust, and audio
   */
  public triggerImpact(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    energy: number = 50.0,
    isBuilding: boolean = false
  ) {
    const scale = Math.min(2.5, Math.max(0.8, energy / 50.0));

    // 1. Play impact audio
    this.audio.playGroundSlam();

    // 2. Spawn physical concrete rubble debris using Rapier 3D
    const shardCount = Math.floor(12 * scale);
    this.physics.spawnDebrisBurst(
      origin,
      direction.clone().negate(),
      shardCount,
      35.0 * scale,
      isBuilding ? 0x64748b : 0x334155
    );

    // 3. Ground / Wall Impact Crater Decal
    this.spawnCrater(origin, direction, scale);

    // 4. Expanding shockwave ring
    this.spawnShockwave(origin, direction, scale);

    // 5. Emit concrete dust burst
    this.emitDust(origin, direction, scale);
  }

  private spawnCrater(origin: THREE.Vector3, normal: THREE.Vector3, scale: number) {
    if (this.craters.length >= this.maxCraters) {
      const oldest = this.craters.shift();
      if (oldest) this.destructionGroup.remove(oldest.mesh);
    }

    const craterRadius = 1.6 * scale;
    const craterGeo = new THREE.RingGeometry(0.2, craterRadius, 24);
    const craterMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a, // scorched black asphalt crater
      roughness: 0.95,
      metalness: 0.1,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
    });

    const craterMesh = new THREE.Mesh(craterGeo, craterMat);
    craterMesh.position.copy(origin);

    // Align crater with surface normal
    if (Math.abs(normal.y) > 0.8) {
      // Ground plane crater
      craterMesh.rotation.x = -Math.PI / 2;
      craterMesh.position.y = 0.08;
    } else {
      // Vertical building facade crater
      craterMesh.lookAt(origin.clone().add(normal));
      craterMesh.position.addScaledVector(normal, 0.05);
    }

    this.destructionGroup.add(craterMesh);
    this.craters.push({
      mesh: craterMesh,
      life: 40.0,
      maxLife: 40.0,
    });
  }

  private spawnShockwave(origin: THREE.Vector3, normal: THREE.Vector3, scale: number) {
    const waveGeo = new THREE.RingGeometry(0.4, 1.2, 32);
    const waveMat = new THREE.MeshBasicMaterial({
      color: 0x93c5fd,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const waveMesh = new THREE.Mesh(waveGeo, waveMat);
    waveMesh.position.copy(origin);

    if (Math.abs(normal.y) > 0.8) {
      waveMesh.rotation.x = -Math.PI / 2;
      waveMesh.position.y = 0.12;
    } else {
      waveMesh.lookAt(origin.clone().add(normal));
    }

    this.destructionGroup.add(waveMesh);
    this.shockwaves.push({
      mesh: waveMesh,
      progress: 0,
      maxScale: 6.0 * scale,
      speed: 16.0,
    });
  }

  private emitDust(origin: THREE.Vector3, normal: THREE.Vector3, scale: number) {
    this.dustMat.opacity = 0.85;
    const pos = this.dustGeo.attributes.position as THREE.BufferAttribute;

    const burstCount = Math.floor(60 * scale);
    for (let i = 0; i < burstCount; i++) {
      const idx = Math.floor(Math.random() * this.dustCount);
      pos.setXYZ(idx, origin.x, origin.y + 0.2, origin.z);

      const angle = Math.random() * Math.PI * 2;
      const speed = (6.0 + Math.random() * 18.0) * scale;
      this.dustVels[idx] = {
        x: Math.cos(angle) * speed,
        y: (2.0 + Math.random() * 8.0) * scale,
        z: Math.sin(angle) * speed,
        life: 1.0,
      };
    }
    pos.needsUpdate = true;
  }

  public update(delta: number) {
    // 1. Update expanding shockwave rings
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.progress += delta * (sw.speed / sw.maxScale);
      const curScale = 1.0 + sw.progress * sw.maxScale;
      sw.mesh.scale.set(curScale, curScale, 1.0);

      const mat = sw.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, 0.9 - sw.progress * 1.1);

      if (sw.progress >= 1.0) {
        this.destructionGroup.remove(sw.mesh);
        this.shockwaves.splice(i, 1);
      }
    }

    // 2. Update crater decals decay
    for (let i = this.craters.length - 1; i >= 0; i--) {
      const crater = this.craters[i];
      crater.life -= delta;
      if (crater.life < 5.0) {
        const mat = crater.mesh.material as THREE.MeshStandardMaterial;
        mat.opacity = (crater.life / 5.0) * 0.88;
      }
      if (crater.life <= 0) {
        this.destructionGroup.remove(crater.mesh);
        this.craters.splice(i, 1);
      }
    }

    // 3. Update dust particles
    let activeDust = false;
    const pos = this.dustGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < this.dustCount; i++) {
      const vel = this.dustVels[i];
      if (vel.life > 0) {
        activeDust = true;
        vel.life -= delta * 1.4;
        const curX = pos.getX(i) + vel.x * delta;
        const curY = Math.max(0.1, pos.getY(i) + vel.y * delta);
        const curZ = pos.getZ(i) + vel.z * delta;

        // Gravity & air resistance on dust
        vel.y -= 7.5 * delta;
        vel.x *= 0.94;
        vel.z *= 0.94;

        pos.setXYZ(i, curX, curY, curZ);
      }
    }
    if (activeDust) {
      pos.needsUpdate = true;
      this.dustMat.opacity = Math.max(0, this.dustMat.opacity - delta * 0.35);
    } else {
      this.dustMat.opacity = 0;
    }
  }
}
