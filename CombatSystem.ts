import * as THREE from 'three';
import { PhysicsEngine } from './PhysicsEngine';
import { DestructionSystem } from './DestructionSystem';
import { CrimeManager } from './CrimeManager';
import { TrafficSystem } from './TrafficSystem';
import { AudioService } from '../services/AudioService';
import { EnemyEntity, LockedTargetInfo } from '../types/game';

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
    const lockGeo = new THREE.RingGeometry(1.6, 2.05, 32);
    const lockMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthTest: false,
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
      // Find closest enemy in front of player (or within mission area)
      let closest: EnemyEntity | null = null;
      let minScore = Infinity;

      for (const enemy of enemies) {
        if (enemy.health <= 0 || !enemy.active) continue;
        const enemyPos = this.getEnemyVector(enemy);
        const dist = playerPos.distanceTo(enemyPos);
        if (dist < 260) {
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

    // 1. Check for nearby traffic cars (within 11 meters)
    const nearbyCar = this.traffic.getNearestCar(playerPos.x, playerPos.y, playerPos.z, 11.0);
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

    // 2. Check for nearby enemy (within 9.5 meters, or 13m for getaway-car)
    const enemies = this.crime.getEnemies();
    for (const enemy of enemies) {
      const enemyPos = this.getEnemyVector(enemy);
      const grabRadius = enemy.type === 'getaway-car' ? 13.0 : 8.0;
      if (enemy.health > 0 && enemy.type !== 'fire' && playerPos.distanceTo(enemyPos) < grabRadius) {
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
  public throwHeldObject(
    playerPos: THREE.Vector3,
    aimDirection: THREE.Vector3,
    onMissionReward?: (hope: number) => void
  ): boolean {
    if (!this.isHolding || !this.heldObject) return false;

    const throwOrigin = playerPos.clone().add(new THREE.Vector3(0, 2.5, 0));
    // If lock-on is active, bias throw direction toward locked target!
    const finalAim = aimDirection.clone();
    if (this.isLockOnActive && this.lockedTarget && this.lockedTarget.active) {
      const toLocked = new THREE.Vector3(
        this.lockedTarget.x - throwOrigin.x,
        this.lockedTarget.y + 0.8 - throwOrigin.y,
        this.lockedTarget.z - throwOrigin.z
      ).normalize();
      finalAim.lerp(toLocked, 0.78).normalize();
    }

    const launchSpeed = 84.0; // ~300 km/h superhuman throw!
    const velocity = finalAim.clone().multiplyScalar(launchSpeed);
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
          // Impact explosion against building, enemy or pavement!
          this.destruction.triggerImpact(
            impactPoint,
            new THREE.Vector3(0, 1, 0),
            impactVelocity * 1.6,
            true
          );
          this.traffic.triggerTrafficPanic(impactPoint.x, impactPoint.z, 35);
          const expRes = this.crime.handleExplosionHit(impactPoint, 24.0, 160);
          if (onMissionReward && (expRes.hits > 0 || expRes.missionCompleted)) {
            onMissionReward(expRes.missionCompleted ? 35 : expRes.hits * 15);
          }
        }
      );
      this.traffic.removeCar(heldId);
    } else {
      // Enemy thrown with high velocity
      const impactPos = throwOrigin.clone().addScaledVector(finalAim, 16.0);
      impactPos.y = Math.max(0.2, impactPos.y);
      this.crime.damageEnemy(heldId, 120, throwOrigin);
      this.destruction.triggerImpact(impactPos, new THREE.Vector3(0, 1, 0), 65.0);
      this.physics.spawnDebrisBurst(throwOrigin, finalAim, 14, 42.0);
      if (onMissionReward) onMissionReward(20);
    }

    this.isHolding = false;
    this.heldObject = null;
    this.trajectoryLine.visible = false;
    return true;
  }

  /**
   * Executes a combo attack (Ground / Aerial Dash Strike / Meteor Slam)
   */
  public executeAttack(
    playerPos: THREE.Vector3,
    forwardDir: THREE.Vector3,
    isFlying: boolean
  ): {
    hitTarget: boolean;
    damageDealt: number;
    comboStep: number;
    dashVelocity?: THREE.Vector3;
    targetRotY?: number;
  } {
    const now = performance.now();
    if (now - this.lastAttackTime < 900) {
      this.comboStep = (this.comboStep + 1) % 4;
    } else {
      this.comboStep = 0;
    }
    this.lastAttackTime = now;
    this.comboTimer = 1.4;

    const damage = this.comboStep === 3 ? 85 : 35 + this.comboStep * 15;
    let hitTarget = false;
    let dashVelocity: THREE.Vector3 | undefined;
    let targetRotY: number | undefined;

    // 1. AERIAL / LOCK-ON DASH STRIKE: If locked onto a target within 75m, dash toward it!
    if (this.isLockOnActive && this.lockedTarget && this.lockedTarget.active && this.lockedTarget.health > 0) {
      const targetPos = this.getEnemyVector(this.lockedTarget);
      const distToLocked = playerPos.distanceTo(targetPos);
      if (distToLocked <= 75) {
        const toTarget = targetPos.clone().sub(playerPos);
        targetRotY = Math.atan2(-toTarget.x, -toTarget.z);

        if (distToLocked > 4.2) {
          const dashSpeed = Math.min(135, Math.max(55, distToLocked * 3.8));
          dashVelocity = toTarget.normalize().multiplyScalar(dashSpeed);
        }

        if (distToLocked < 16.5) {
          hitTarget = true;
          if (this.comboStep === 3 && isFlying) {
            // AERIAL METEOR SLAM: Slam enemy vertically down into the concrete!
            const slamDir = new THREE.Vector3(0, -1, 0);
            this.lockedTarget.y = 0.0;
            const groundImpact = new THREE.Vector3(this.lockedTarget.x, 0.1, this.lockedTarget.z);
            this.crime.damageEnemy(this.lockedTarget.id, damage + 40, playerPos);
            this.destruction.triggerImpact(groundImpact, slamDir, 95.0);
            dashVelocity = new THREE.Vector3(0, -90, 0);
          } else {
            this.crime.damageEnemy(this.lockedTarget.id, damage, playerPos);
            this.destruction.triggerImpact(targetPos, forwardDir, 48.0 + this.comboStep * 15.0);
          }
        }
      }
    }

    // 2. Standard melee hit cone in front of Superman
    const attackReach = 9.2;
    const attackCenter = playerPos.clone().addScaledVector(forwardDir, 2.8);

    const enemies = this.crime.getEnemies();
    for (const enemy of enemies) {
      if (enemy.health <= 0 || !enemy.active) continue;
      if (hitTarget && this.lockedTarget && enemy.id === this.lockedTarget.id) continue;

      const enemyPos = this.getEnemyVector(enemy);
      const dist = attackCenter.distanceTo(enemyPos);
      if (dist < attackReach) {
        hitTarget = true;

        if (this.comboStep === 3 && isFlying) {
          const slamDir = new THREE.Vector3(0, -1, 0);
          enemy.y = 0.0;
          this.crime.damageEnemy(enemy.id, damage, playerPos);
          this.destruction.triggerImpact(new THREE.Vector3(enemy.x, 0.1, enemy.z), slamDir, 85.0);
        } else {
          this.crime.damageEnemy(enemy.id, damage, playerPos);
          this.destruction.triggerImpact(enemyPos, forwardDir, 45.0 + this.comboStep * 15.0);
        }
      }
    }

    return { hitTarget, damageDealt: damage, comboStep: this.comboStep, dashVelocity, targetRotY };
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
      const points = this.physics.predictTrajectory(startPos, aimDir, 84.0, 28, 0.04);
      this.trajectoryGeo.setFromPoints(points);
      this.trajectoryLine.computeLineDistances();
      this.trajectoryLine.visible = true;
    } else {
      this.trajectoryLine.visible = false;
    }

    // 3. Update Lock-On Reticle
    if (this.isLockOnActive && this.lockedTarget) {
      if (this.lockedTarget.health <= 0 || !this.lockedTarget.active) {
        // Auto-switch to next living enemy in mission if available
        const remaining = this.crime.getEnemies().filter((e) => e.health > 0 && e.active);
        if (remaining.length > 0) {
          this.lockedTarget = remaining[0];
        } else {
          this.lockedTarget = null;
          this.isLockOnActive = false;
          this.lockOnMesh.visible = false;
        }
      }
      if (this.lockedTarget) {
        this.lockOnMesh.visible = true;
        this.lockOnMesh.position.set(
          this.lockedTarget.x,
          this.lockedTarget.y + 1.1,
          this.lockedTarget.z
        );
        this.lockOnMesh.lookAt(playerPos);
        this.lockOnMesh.rotation.z += delta * 4.5; // Spin reticle
      }
    } else {
      this.lockOnMesh.visible = false;
    }
  }

  public getComboStep(): number {
    return this.comboTimer > 0 ? this.comboStep + 1 : 0;
  }

  public getLockedTargetInfo(playerPos: THREE.Vector3): LockedTargetInfo | null {
    if (!this.isLockOnActive || !this.lockedTarget || !this.lockedTarget.active) return null;
    const dist = Math.round(
      Math.hypot(
        this.lockedTarget.x - playerPos.x,
        this.lockedTarget.y - playerPos.y,
        this.lockedTarget.z - playerPos.z
      )
    );
    return {
      id: this.lockedTarget.id,
      type: this.lockedTarget.type,
      health: Math.max(0, Math.round(this.lockedTarget.health)),
      maxHealth: this.lockedTarget.maxHealth,
      distance: dist,
    };
  }
}
