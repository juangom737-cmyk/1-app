import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

export interface DynamicPhysicsObject {
  id: string;
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  mesh: THREE.Object3D;
  life: number;
  maxLife: number;
  prevSpeed?: number;
  isCar?: boolean;
  isDebris?: boolean;
  isEnemy?: boolean;
  onImpact?: (impactPoint: THREE.Vector3, velocity: number) => void;
}

export class PhysicsEngine {
  private static instance: PhysicsEngine | null = null;
  public rapier: typeof RAPIER | null = null;
  public world: RAPIER.World | null = null;
  public isReady: boolean = false;
  private playerController: RAPIER.KinematicCharacterController | null = null;
  private playerCollider: RAPIER.Collider | null = null;
  private playerColliderOffset = 0.9;
  private physicsAccumulator = 0;

  private scene: THREE.Scene;
  private dynamicObjects: Map<string, DynamicPhysicsObject> = new Map();
  private debrisGroup: THREE.Group;
  private maxDebrisCount: number = 75;
  private debrisPool: DynamicPhysicsObject[] = [];
  private sharedShardGeo: THREE.DodecahedronGeometry;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.debrisGroup = new THREE.Group();
    this.scene.add(this.debrisGroup);
    this.sharedShardGeo = new THREE.DodecahedronGeometry(0.85, 0);
    PhysicsEngine.instance = this;
  }

  public static getInstance(): PhysicsEngine | null {
    return PhysicsEngine.instance;
  }

  public async init(): Promise<boolean> {
    try {
      await RAPIER.init();
      this.rapier = RAPIER;
      // Realistic Earth gravity
      const gravity = { x: 0.0, y: -9.81, z: 0.0 };
      this.world = new RAPIER.World(gravity);
      this.isReady = true;

      // Ground plane collider
      const groundColliderDesc = RAPIER.ColliderDesc.cuboid(1800, 2.0, 1800);
      groundColliderDesc.setTranslation(0, -2.0, 0);
      groundColliderDesc.setRestitution(0.2);
      groundColliderDesc.setFriction(0.7);
      this.world.createCollider(groundColliderDesc);

      return true;
    } catch (err) {
      console.error('Failed to initialize Rapier 3D physics engine:', err);
      this.isReady = false;
      return false;
    }
  }

  /**
   * Registers a static building bounding collider for Rapier collision detection
   */
  public addBuildingCollider(
    x: number,
    z: number,
    width: number,
    depth: number,
    height: number
  ): RAPIER.Collider | null {
    if (!this.world || !this.rapier) return null;

    const halfW = width / 2;
    const halfH = height / 2;
    const halfD = depth / 2;

    const colliderDesc = this.rapier.ColliderDesc.cuboid(halfW, halfH, halfD);
    colliderDesc.setTranslation(x, halfH, z);
    colliderDesc.setRestitution(0.15);
    colliderDesc.setFriction(0.6);
    return this.world.createCollider(colliderDesc);
  }

  /** Uses the actual faceted terrain mesh as a static convex obstacle. */
  public addTerrainCollider(mesh: THREE.Mesh): RAPIER.Collider | null {
    if (!this.world || !this.rapier) return null;
    const positions = mesh.geometry.getAttribute('position');
    if (!positions || positions.count < 4) return null;
    mesh.updateWorldMatrix(true, false);
    const vertices = new Float32Array(positions.count * 3);
    const point = new THREE.Vector3();
    for (let i = 0; i < positions.count; i++) {
      point.set(positions.getX(i), positions.getY(i), positions.getZ(i)).applyMatrix4(mesh.matrixWorld);
      vertices[i * 3] = point.x;
      vertices[i * 3 + 1] = point.y;
      vertices[i * 3 + 2] = point.z;
    }
    const collider = this.rapier.ColliderDesc.convexHull(vertices);
    if (!collider) return null;
    collider.setFriction(0.9).setRestitution(0);
    return this.world.createCollider(collider);
  }

  /** Creates the hero capsule and Rapier move-and-slide controller after the city colliders are registered. */
  public addPlayerController(): boolean {
    if (!this.world || !this.rapier || this.playerCollider) return Boolean(this.playerCollider);

    // Flush the newly added static colliders into Rapier's broad phase before
    // the first character shape-cast. The world may otherwise have no dynamic
    // objects yet and therefore would not have stepped.
    this.world.step();
    this.playerController = this.world.createCharacterController(0.06);
    this.playerController.setMaxSlopeClimbAngle((48 * Math.PI) / 180);
    this.playerController.setMinSlopeSlideAngle((32 * Math.PI) / 180);
    this.playerController.enableAutostep(0.35, 0.18, true);
    this.playerController.enableSnapToGround(0.25);
    const capsule = this.rapier.ColliderDesc.capsule(0.55, 0.38)
      .setTranslation(0, this.playerColliderOffset, 0)
      .setFriction(0.8)
      .setRestitution(0);
    this.playerCollider = this.world.createCollider(capsule);
    return true;
  }

  /** Returns Rapier's swept, collision-corrected movement for the hero's feet position. */
  public movePlayer(
    feet: THREE.Vector3,
    desiredDelta: THREE.Vector3
  ): { delta: THREE.Vector3; grounded: boolean; hit: boolean } | null {
    if (!this.world || !this.playerController || !this.playerCollider) return null;

    this.playerCollider.setTranslation({ x: feet.x, y: feet.y + this.playerColliderOffset, z: feet.z });
    this.playerController.computeColliderMovement(this.playerCollider, {
      x: desiredDelta.x,
      y: desiredDelta.y,
      z: desiredDelta.z,
    });
    const movement = this.playerController.computedMovement();
    const corrected = new THREE.Vector3(movement.x, movement.y, movement.z);
    this.playerCollider.setTranslation({
      x: feet.x + corrected.x,
      y: feet.y + corrected.y + this.playerColliderOffset,
      z: feet.z + corrected.z,
    });
    return {
      delta: corrected,
      grounded: this.playerController.computedGrounded(),
      hit: this.playerController.numComputedCollisions() > 0,
    };
  }

  /**
   * Spawns a physical dynamic throwable car into the physics world
   */
  public createThrowableCar(
    position: THREE.Vector3,
    quaternion: THREE.Quaternion,
    velocity: THREE.Vector3,
    carMesh: THREE.Object3D,
    onImpact?: (impactPoint: THREE.Vector3, velocity: number) => void
  ): DynamicPhysicsObject | null {
    if (!this.world || !this.rapier) return null;

    const id = `car_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    const bodyDesc = this.rapier.RigidBodyDesc.dynamic()
      .setTranslation(position.x, position.y, position.z)
      .setRotation({ x: quaternion.x, y: quaternion.y, z: quaternion.z, w: quaternion.w })
      .setLinvel(velocity.x, velocity.y, velocity.z)
      .setAngvel({
        x: (Math.random() - 0.5) * 8.0,
        y: (Math.random() - 0.5) * 5.0,
        z: (Math.random() - 0.5) * 8.0,
      })
      .setLinearDamping(0.08)
      .setAngularDamping(0.2);

    const body = this.world.createRigidBody(bodyDesc);

    // Car bounding box collider (approx standard sedan size: 4.4m x 1.6m x 2.2m)
    const colliderDesc = this.rapier.ColliderDesc.cuboid(2.2, 0.8, 1.1)
      .setRestitution(0.35)
      .setFriction(0.5)
      .setDensity(1.2);

    const collider = this.world.createCollider(colliderDesc, body);

    this.scene.add(carMesh);

    const initialSpeed = velocity.length();
    const dynObj: DynamicPhysicsObject = {
      id,
      body,
      collider,
      mesh: carMesh,
      life: 25.0,
      maxLife: 25.0,
      prevSpeed: initialSpeed,
      isCar: true,
      onImpact,
    };

    this.dynamicObjects.set(id, dynObj);
    return dynObj;
  }

  /**
   * Spawns physical concrete rubble shards when a building or vehicle is shattered
   */
  public spawnDebrisBurst(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    count: number = 18,
    impulseStrength: number = 45.0,
    materialColor: number = 0x64748b
  ) {
    if (!this.world || !this.rapier) return;

    // Prune debris pool if exceeding maximum count
    while (this.debrisPool.length + count > this.maxDebrisCount && this.debrisPool.length > 0) {
      const oldest = this.debrisPool.shift();
      if (oldest) {
        this.removeDynamicObject(oldest.id);
      }
    }

    for (let i = 0; i < count; i++) {
      const id = `debris_${Date.now()}_${i}_${Math.random()}`;
      const shardMat = new THREE.MeshStandardMaterial({
        color: materialColor,
        roughness: 0.85,
        metalness: 0.1,
      });
      const mesh = new THREE.Mesh(this.sharedShardGeo, shardMat);
      const scale = 0.65 + Math.random() * 0.7;
      mesh.scale.setScalar(scale);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.debrisGroup.add(mesh);

      // Random scattered impulse directed outward
      const spreadX = direction.x + (Math.random() - 0.5) * 1.8;
      const spreadY = Math.max(0.2, direction.y + Math.random() * 1.2);
      const spreadZ = direction.z + (Math.random() - 0.5) * 1.8;
      const len = Math.hypot(spreadX, spreadY, spreadZ) || 1;

      const velX = (spreadX / len) * impulseStrength * (0.6 + Math.random() * 0.8);
      const velY = (spreadY / len) * impulseStrength * (0.6 + Math.random() * 0.8);
      const velZ = (spreadZ / len) * impulseStrength * (0.6 + Math.random() * 0.8);

      const spawnX = origin.x + (Math.random() - 0.5) * 1.5;
      const spawnY = Math.max(0.5, origin.y + (Math.random() - 0.5) * 1.5);
      const spawnZ = origin.z + (Math.random() - 0.5) * 1.5;

      const bodyDesc = this.rapier.RigidBodyDesc.dynamic()
        .setTranslation(spawnX, spawnY, spawnZ)
        .setLinvel(velX, velY, velZ)
        .setAngvel({
          x: (Math.random() - 0.5) * 20.0,
          y: (Math.random() - 0.5) * 20.0,
          z: (Math.random() - 0.5) * 20.0,
        })
        .setLinearDamping(0.12)
        .setAngularDamping(0.25);

      const body = this.world.createRigidBody(bodyDesc);
      const colliderDesc = this.rapier.ColliderDesc.ball(0.65 * scale)
        .setRestitution(0.4)
        .setFriction(0.6)
        .setDensity(2.4);

      const collider = this.world.createCollider(colliderDesc, body);

      const dynObj: DynamicPhysicsObject = {
        id,
        body,
        collider,
        mesh,
        life: 7.0 + Math.random() * 4.0,
        maxLife: 11.0,
        isDebris: true,
      };

      this.dynamicObjects.set(id, dynObj);
      this.debrisPool.push(dynObj);
    }
  }

  /**
   * Removes a dynamic physics object and cleans up its Three.js mesh & Rapier bodies
   */
  public removeDynamicObject(id: string) {
    const obj = this.dynamicObjects.get(id);
    if (!obj) return;

    if (obj.mesh.parent) {
      obj.mesh.parent.remove(obj.mesh);
    }
    if (obj.isDebris && obj.mesh instanceof THREE.Mesh && obj.mesh.material instanceof THREE.Material) {
      obj.mesh.material.dispose();
    }
    if (this.world && this.world.getRigidBody(obj.body.handle)) {
      this.world.removeRigidBody(obj.body);
    }
    this.dynamicObjects.delete(id);

    const poolIdx = this.debrisPool.indexOf(obj);
    if (poolIdx !== -1) {
      this.debrisPool.splice(poolIdx, 1);
    }
  }

  /**
   * Computes a preview arc of points for the throwing trajectory
   */
  public predictTrajectory(
    startPos: THREE.Vector3,
    forwardDir: THREE.Vector3,
    speed: number = 75.0,
    steps: number = 30,
    timeStep: number = 0.05
  ): THREE.Vector3[] {
    const points: THREE.Vector3[] = [];
    const gravityY = -9.81;

    let posX = startPos.x;
    let posY = startPos.y;
    let posZ = startPos.z;

    let velX = forwardDir.x * speed;
    let velY = forwardDir.y * speed + 6.0; // slight upward arc
    let velZ = forwardDir.z * speed;

    for (let i = 0; i < steps; i++) {
      points.push(new THREE.Vector3(posX, posY, posZ));
      posX += velX * timeStep;
      posY += velY * timeStep;
      posZ += velZ * timeStep;
      velY += gravityY * timeStep;

      // Stop trajectory if hitting floor
      if (posY <= 0.2) {
        points.push(new THREE.Vector3(posX, 0.2, posZ));
        break;
      }
    }

    return points;
  }

  /**
   * Advances the Rapier physics simulation and synchronizes Three.js meshes
   */
  public step(delta: number) {
    if (!this.world || !this.isReady || this.dynamicObjects.size === 0) return;

    // A fixed step keeps thrown cars and debris stable during frame-rate swings.
    const cappedDelta = Math.min(delta, 0.05);
    const fixedStep = 1 / 60;
    this.physicsAccumulator = Math.min(this.physicsAccumulator + cappedDelta, fixedStep * 4);
    let stepCount = 0;
    while (this.physicsAccumulator >= fixedStep && stepCount < 4) {
      this.world.timestep = fixedStep;
      this.world.step();
      this.physicsAccumulator -= fixedStep;
      stepCount += 1;
    }

    // Sync mesh transforms with Rapier bodies
    const toRemove: string[] = [];

    this.dynamicObjects.forEach((obj, id) => {
      obj.life -= cappedDelta;
      if (obj.life <= 0) {
        toRemove.push(id);
        return;
      }

      const translation = obj.body.translation();
      const rotation = obj.body.rotation();

      obj.mesh.position.set(translation.x, translation.y, translation.z);
      obj.mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);

      // Check for ground or building wall impact for thrown cars
      if (obj.isCar && obj.onImpact) {
        const linvel = obj.body.linvel();
        const currentSpeed = Math.hypot(linvel.x, linvel.y, linvel.z);
        const speedDrop = (obj.prevSpeed ?? currentSpeed) - currentSpeed;
        obj.prevSpeed = currentSpeed;

        const hitGround = translation.y <= 1.25 && currentSpeed > 14.0;
        const hitWall = speedDrop > 15.0 && (obj.maxLife - obj.life) > 0.04;

        if (hitGround || hitWall) {
          const impactVel = Math.max(currentSpeed, (obj.prevSpeed ?? 0) + speedDrop);
          obj.onImpact(
            new THREE.Vector3(translation.x, Math.max(0.2, translation.y), translation.z),
            impactVel
          );
          obj.onImpact = undefined; // trigger once
        }
      }

      // Fade out debris as they reach end of life
      if (obj.isDebris && obj.mesh instanceof THREE.Mesh) {
        const mat = obj.mesh.material;
        if (mat instanceof THREE.MeshStandardMaterial && obj.life < 2.0) {
          mat.transparent = true;
          mat.opacity = obj.life / 2.0;
        }
      }
    });

    toRemove.forEach((id) => this.removeDynamicObject(id));
  }

  public getDynamicObjectsCount(): number {
    return this.dynamicObjects.size;
  }

  public dispose() {
    this.dynamicObjects.forEach((_, id) => this.removeDynamicObject(id));
    if (this.world && this.playerCollider) this.world.removeCollider(this.playerCollider, true);
    if (this.world && this.playerController) this.world.removeCharacterController(this.playerController);
    this.playerCollider = null;
    this.playerController = null;
    this.scene.remove(this.debrisGroup);
    this.sharedShardGeo.dispose();
  }
}
