import * as THREE from 'three';
import { PhysicsEngine } from './PhysicsEngine';
import { DestructionSystem } from './DestructionSystem';
import { CrimeManager } from './CrimeManager';
import { TrafficSystem } from './TrafficSystem';
import { AudioService } from '../services/AudioService';
import { EnemyEntity } from '../types/game';

export interface HeldObject {
  type: 'car' | 'enemy';
  id: string;
  mesh: THREE.Object3D;
  originalParent: THREE.Object3D | null;
}

export class CombatSystem {
  private scene: THREE.Scene;
  private physics: PhysicsEngine;
  private destruction: DestructionSystem;
  private crime: CrimeManager;
  private traffic: TrafficSystem;
  private audio: AudioService;

  // Grab & Throw State
  public isHolding: boolean = false;
  public heldObject: HeldObject | null = null;
  private trajectoryLine: THREE.Line;
  private trajectoryGeo: THREE.BufferGeometry;

  // Target Lock-On State
  public lockedTarget: EnemyEntity | null = null;
  public lockOnMesh: THREE.Mesh;
  public isLockOnActive: boolean = false;

  // Combat Combo State
  private comboStep: number = 0;
  private comboTimer: number = 0;
  private lastAttackTime: number = 0;

  constructor(
    scene: THREE.Scene,
    physics: PhysicsEngine,
    destruction: DestructionSystem,
    crime: CrimeManager,
    traffic: TrafficSystem
  ) {
    this.scene = scene;
    this.physics = physics;
    this.destruction = destruction;
    this.crime = crime;
    this.traffic = traffic;
    this.audio = AudioService.getInstance();

    // 1. Aiming Trajectory Line (Parabolic Arc)
    this.trajectoryGeo = new THREE.BufferGeometry();
    const lineMat = new THREE.LineDashedMaterial({
      color: 0x38bdf8,
      linewidth: 3,
      scale: 1,
      dashSize: 1.5,
      gapSize: 0.8,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
    });
    this.trajectoryLine = new THREE.Line(this.trajectoryGeo, lineMat);
    this.trajectoryLine.visible = false;
    this.scene.add(this.trajectoryLine);

    // 2. Lock-on Reticle (Rotating Holographic Crosshair)
    const lockGeo = new THREE.RingGeometry(1.6, 2.0, 32);
    const lockMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
    });
    this.lockOnMesh = new THREE.Mesh(lockGeo, lockMat);
    this.lockOnMesh.visible = false;
    this.scene.add(this.lockOnMesh);
  }

  private getEnemyVector(enemy: EnemyEntity): THREE.Vector3 {
    return new THREE.Vector3(enemy.x, enemy.y, enemy.z);
  }

  /**
   * Toggles lock-on targeting between available nearby enemies
   */
  public toggleLockOn(playerPos: THREE.Vector3, cameraDir: THREE.Vector3) {
    const enemies = this.crime.getEnemies();
    if (enemies.length === 0) {
      this.lockedTarget = null;
      this.isLockOnActive = false;
      this.lockOnMesh.visible = false;
      return;
    }

    if (this.isLockOnActive && this.lockedTarget) {
      // Find next enemy or unlock
      const currentIndex = enemies.findIndex((e) => e.id === this.lockedTarget?.id);
      if (currentIndex !== -1 && currentIndex < enemies.length - 1) {
        this.lockedTarget = enemies[currentIndex + 1];
      } else {
        // Unlock
        this.lockedTarget = null;
        this.isLockOnActive = false;
        this.lockOnMesh.visible = false;
        return;
      }
    } else {
      // Find closest enemy in front of player
      let closest: EnemyEntity | null = null;
      let minScore = Infinity;

      for (const enemy of enemies) {
        if (enemy.health <= 0) continue;
        const enemyPos = this.getEnemyVector(enemy);
        const dist = playerPos.distanceTo(enemyPos);
        if (dist < 180) {
          const toEnemy = enemyPos.clone().sub(playerPos).normalize();
          const dot = cameraDir.dot(toEnemy);
          // Prioritize enemies centered in camera view
          const score = dist * (2.0 - Math.max(0, dot));
          if (score < minScore) {
            minScore = score;
            closest = enemy;
          }
        }
      }

      this.lockedTarget = closest;
      this.isLockOnActive = Boolean(closest);
    }

    if (this.lockedTarget) {
      this.audio.playPunchImpact();
    }
  }

  /**
   * Attempts to grab a nearby car or enemy
   */
  public attemptGrab(playerPos: THREE.Vector3): boolean {
    if (this.isHolding) {
      // If already holding, throw the object!
      return this.throwHeldObject(playerPos, new THREE.Vector3(0, 0, 1));
    }

    // 1. Check for nearby traffic cars (within 9.5 meters)
    const nearbyCar = this.traffic.getNearestCar(playerPos.x, playerPos.y, playerPos.z, 9.5);
    if (nearbyCar) {
      const carMesh = this.traffic.getCarMesh(nearbyCar.id);
      if (carMesh) {
        const originalParent = carMesh.parent;

        this.heldObject = {
          type: 'car',
          id: nearbyCar.id,
          mesh: carMesh,
          originalParent,
        };
        this.isHolding = true;
        this.audio.playPunchImpact();

        // Temporarily detach from traffic update
        this.traffic.freezeCar(nearbyCar.id);
        return true;
      }
    }

    // 2. Check for nearby enemy (within 6.5 meters)
    const enemies = this.crime.getEnemies();
    for (const enemy of enemies) {
      const enemyPos = this.getEnemyVector(enemy);
      if (enemy.health > 0 && playerPos.distanceTo(enemyPos) < 6.5) {
        const enemyMesh = this.crime.getEnemyMesh(enemy.id);
        if (enemyMesh) {
          this.heldObject = {
            type: 'enemy',
            id: enemy.id,
            mesh: enemyMesh,
            originalParent: enemyMesh.parent,
          };
          this.isHolding = true;
          this.audio.playPunchImpact();
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Throws the currently held object with superhuman power along aiming direction
   */
  public throwHeldObject(playerPos: THREE.Vector3, aimDirection: THREE.Vector3): boolean {
    if (!this.isHolding || !this.heldObject) return false;

    const throwOrigin = playerPos.clone().add(new THREE.Vector3(0, 2.5, 0));
    const launchSpeed = 82.0; // ~295 km/h superhuman throw!
    const velocity = aimDirection.clone().multiplyScalar(launchSpeed);
    velocity.y += 6.0; // parabolic loft

    const heldMesh = this.heldObject.mesh;
    const heldId = this.heldObject.id;
    const isCar = this.heldObject.type === 'car';

    // Play sonic whoosh
    this.audio.playInstantSonicBoom();

    if (isCar) {
      // Create Rapier 3D rigid body for the car
      this.physics.createThrowableCar(
        throwOrigin,
        heldMesh.quaternion,
        velocity,
        heldMesh,
        (impactPoint, impactVelocity) => {
          // Impact explosion against building or pavement!
          this.destruction.triggerImpact(impactPoint, new THREE.Vector3(0, 1, 0), impactVelocity * 1.5, true);
        }
      );
      this.traffic.removeCar(heldId);
    } else {
      // Enemy thrown with high velocity
      this.crime.damageEnemy(heldId, 65, throwOrigin);
      this.physics.spawnDebrisBurst(throwOrigin, aimDirection, 14, 40.0);
    }

    this.isHolding = false;
    this.heldObject = null;
    this.trajectoryLine.visible = false;
    return true;
  }

  /**
   * Executes a combo attack (Ground / Aerial strike / Meteor slam)
   */
  public executeAttack(
    playerPos: THREE.Vector3,
    forwardDir: THREE.Vector3,
    isFlying: boolean
  ): { hitTarget: boolean; damageDealt: number; comboStep: number } {
    const now = performance.now();
    if (now - this.lastAttackTime < 800) {
      this.comboStep = (this.comboStep + 1) % 4;
    } else {
      this.comboStep = 0;
    }
    this.lastAttackTime = now;
    this.comboTimer = 1.2;

    const damage = this.comboStep === 3 ? 60 : 25 + this.comboStep * 10;
    let hitTarget = false;

    // Check hit radius: in front of Superman
    const attackReach = 8.5;
    const attackCenter = playerPos.clone().addScaledVector(forwardDir, 2.5);

    const enemies = this.crime.getEnemies();
    for (const enemy of enemies) {
      if (enemy.health <= 0) continue;
      const enemyPos = this.getEnemyVector(enemy);
      const dist = attackCenter.distanceTo(enemyPos);
      if (dist < attackReach) {
        hitTarget = true;

        if (this.comboStep === 3 && isFlying) {
          // AERIAL METEOR SLAM: Slam enemy vertically down into the concrete
          const slamDir = new THREE.Vector3(0, -1, 0);
          this.crime.damageEnemy(enemy.id, damage, playerPos);
          this.destruction.triggerImpact(enemyPos, slamDir, 85.0);
        } else {
          // Horizontal punch impact
          this.crime.damageEnemy(enemy.id, damage, playerPos);
          this.destruction.triggerImpact(enemyPos, forwardDir, 45.0 + this.comboStep * 15.0);
        }
      }
    }

    return { hitTarget, damageDealt: damage, comboStep: this.comboStep };
  }

  /**
   * Updates aiming trajectory, held object placement, and lock-on HUD in render loop
   */
  public update(
    delta: number,
    playerPos: THREE.Vector3,
    playerRotY: number,
    aimDir: THREE.Vector3
  ) {
    if (this.comboTimer > 0) {
      this.comboTimer -= delta;
      if (this.comboTimer <= 0) {
        this.comboStep = 0;
      }
    }

    // 1. Update Held Object Position (Holding overhead)
    if (this.isHolding && this.heldObject) {
      const holdY = playerPos.y + 2.85;
      this.heldObject.mesh.position.set(playerPos.x, holdY, playerPos.z);
      this.heldObject.mesh.rotation.y = playerRotY;

      // 2. Draw Aiming Trajectory Arc
      const startPos = new THREE.Vector3(playerPos.x, holdY, playerPos.z);
      const points = this.physics.predictTrajectory(startPos, aimDir, 82.0, 28, 0.04);
      this.trajectoryGeo.setFromPoints(points);
      this.trajectoryLine.computeLineDistances();
      this.trajectoryLine.visible = true;
    } else {
      this.trajectoryLine.visible = false;
    }

    // 3. Update Lock-On Reticle
    if (this.isLockOnActive && this.lockedTarget) {
      if (this.lockedTarget.health <= 0) {
        this.lockedTarget = null;
        this.isLockOnActive = false;
        this.lockOnMesh.visible = false;
      } else {
        this.lockOnMesh.visible = true;
        this.lockOnMesh.position.set(this.lockedTarget.x, this.lockedTarget.y, this.lockedTarget.z);
        this.lockOnMesh.lookAt(playerPos);
        this.lockOnMesh.rotation.z += delta * 4.0; // Spin reticle
      }
    } else {
      this.lockOnMesh.visible = false;
    }
  }

  public getComboStep(): number {
    return this.comboStep;
  }
}
