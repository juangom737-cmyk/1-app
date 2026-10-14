import * as THREE from 'three';
import { TrafficCar } from '../types/game';

export class TrafficSystem {
  public cars: TrafficCar[] = [];
  private carMeshes: Map<string, THREE.Group> = new Map();
  private sceneGroup: THREE.Group;
  private idCounter: number = 1;

  // Shared geometries & materials for lower GPU overhead
  private wheelGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.4, 12);
  private wheelMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9 });
  private lightGeo = new THREE.SphereGeometry(0.25, 8, 8);
  private headMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
  private tailMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
  private cabinMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.1,
    metalness: 0.9,
  });

  constructor(scene: THREE.Scene) {
    this.sceneGroup = new THREE.Group();
    scene.add(this.sceneGroup);
    this.initCars();
  }

  private initCars() {
    const lanes: { axis: 'x' | 'z'; coord: number; dir: 1 | -1; brt?: boolean }[] = [];
    // Keep vehicle center lines inside the actual 14–20 m asphalt strips.
    // Two directions share each avenue, with a three-metre lane offset.
    for (const road of [-540, -300, 300, 540]) {
      lanes.push(
        { axis: 'x', coord: road - 3, dir: 1 },
        { axis: 'x', coord: road + 3, dir: -1 },
        { axis: 'z', coord: road - 3, dir: 1 },
        { axis: 'z', coord: road + 3, dir: -1 }
      );
    }
    lanes.push(
      { axis: 'x', coord: 84.5, dir: 1, brt: true },
      { axis: 'x', coord: 95.5, dir: -1, brt: true }
    );
    lanes.forEach((lane) => {
      const count = lane.brt ? 4 : 3;
      for (let i = 0; i < count; i++) {
        const offset = lane.brt
          ? -480 + i * 320 + (Math.random() - 0.5) * 24
          : -400 + i * 400 + (Math.random() - 0.5) * 32;
        this.spawnCarInLane(lane.axis, lane.coord, lane.dir, offset, Boolean(lane.brt));
      }
    });
  }

  private spawnCarInLane(axis: 'x' | 'z', coord: number, dir: 1 | -1, offset: number, isBrtLane = false) {
    const id = `car_${this.idCounter++}`;
    const typeRand = Math.random();
    const type: TrafficCar['type'] = isBrtLane
      ? 'transmilenio'
      :
      typeRand < 0.09
        ? 'transmilenio'
        : typeRand < 0.37
        ? 'taxi'
        : typeRand < 0.54
        ? 'police'
        : typeRand < 0.85
        ? 'sedan'
        : 'truck';

    const color =
      type === 'transmilenio'
        ? '#c62935'
        : type === 'taxi'
        ? '#eab308'
        : type === 'police'
        ? '#0f172a'
        : type === 'truck'
        ? '#334155'
        : ['#ef4444', '#3b82f6', '#e2e8f0', '#10b981'][Math.floor(Math.random() * 4)];

    const carData: TrafficCar = {
      id,
      x: axis === 'z' ? offset : coord,
      y: 0.8,
      z: axis === 'x' ? offset : coord,
      rotationY: axis === 'x' ? (dir === 1 ? 0 : Math.PI) : dir === 1 ? Math.PI / 2 : -Math.PI / 2,
      speed: type === 'transmilenio' ? 10 + Math.random() * 4 : 16 + Math.random() * 8,
      color,
      type,
      lane: axis === 'x' ? 'north-south' : 'east-west',
      direction: dir,
      frozen: false,
      panicTimer: 0,
    };

    this.cars.push(carData);
    this.createCarMesh(carData);
  }

  private createCarMesh(car: TrafficCar) {
    const carGroup = new THREE.Group();

    // Body dimensions
    const isBus = car.type === 'transmilenio';
    const isTruck = car.type === 'truck';
    const width = isBus ? 3 : isTruck ? 3.2 : 2.4;
    const height = isBus ? 3.4 : isTruck ? 2.6 : 1.3;
    const length = isBus ? 12 : isTruck ? 6.5 : 4.6;

    // Chassis
    const chassisGeo = new THREE.BoxGeometry(width, height * 0.6, length);
    const chassisMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(car.color),
      roughness: 0.3,
      metalness: 0.7,
    });
    const chassis = new THREE.Mesh(chassisGeo, chassisMat);
    chassis.position.y = height * 0.3 + 0.3;
    chassis.castShadow = true;
    carGroup.add(chassis);

    if (isBus) {
      // A compact articulated silhouette makes Bogotá's red BRT buses legible
      // at street level while keeping the traffic count and draw calls modest.
      const rearSection = new THREE.Mesh(
        new THREE.BoxGeometry(width * 0.96, height * 0.68, length * 0.34),
        chassisMat
      );
      rearSection.position.set(0, height * 0.36, -length * 0.49);
      rearSection.castShadow = true;
      carGroup.add(rearSection);
      const articulation = new THREE.Mesh(
        new THREE.BoxGeometry(width * 0.84, height * 0.62, 1.25),
        new THREE.MeshStandardMaterial({ color: 0x20262b, roughness: 0.9 })
      );
      articulation.position.set(0, height * 0.37, -length * 0.31);
      carGroup.add(articulation);
      const yellowStripe = new THREE.Mesh(
        new THREE.BoxGeometry(width + 0.05, 0.16, length * 0.76),
        new THREE.MeshBasicMaterial({ color: 0xf3c84b })
      );
      yellowStripe.position.set(0, height * 0.26, -length * 0.08);
      carGroup.add(yellowStripe);
    }

    // Cabin
    const cabinGeo = new THREE.BoxGeometry(width * 0.85, height * 0.5, length * 0.55);
    const cabin = new THREE.Mesh(cabinGeo, this.cabinMat);
    cabin.position.set(0, height * 0.7 + 0.2, -length * 0.05);
    carGroup.add(cabin);

    // Wheels
    const wheelPositions = [
      [-width / 2, 0.4, -length * 0.3],
      [width / 2, 0.4, -length * 0.3],
      [-width / 2, 0.4, length * 0.3],
      [width / 2, 0.4, length * 0.3],
    ];

    wheelPositions.forEach(([wx, wy, wz]) => {
      const wheel = new THREE.Mesh(this.wheelGeo, this.wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(wx, wy, wz);
      carGroup.add(wheel);
    });

    // Headlights & Taillights
    const leftHead = new THREE.Mesh(this.lightGeo, this.headMat);
    leftHead.position.set(-width * 0.35, height * 0.4, length * 0.5);
    const rightHead = new THREE.Mesh(this.lightGeo, this.headMat);
    rightHead.position.set(width * 0.35, height * 0.4, length * 0.5);
    carGroup.add(leftHead);
    carGroup.add(rightHead);

    const leftTail = new THREE.Mesh(this.lightGeo, this.tailMat);
    leftTail.position.set(-width * 0.35, height * 0.4, -length * 0.5);
    const rightTail = new THREE.Mesh(this.lightGeo, this.tailMat);
    rightTail.position.set(width * 0.35, height * 0.4, -length * 0.5);
    carGroup.add(leftTail);
    carGroup.add(rightTail);

    // Police flashing siren bar
    if (car.type === 'police') {
      const sirenGeo = new THREE.BoxGeometry(1.2, 0.25, 0.4);
      const sirenMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
      const siren = new THREE.Mesh(sirenGeo, sirenMat);
      siren.name = 'police_siren';
      siren.position.set(0, height + 0.3, 0);
      carGroup.add(siren);
    }

    carGroup.position.set(car.x, car.y, car.z);
    carGroup.rotation.y = car.rotationY;
    this.sceneGroup.add(carGroup);
    this.carMeshes.set(car.id, carGroup);
  }

  public triggerTrafficPanic(originX: number, originZ: number, radius: number = 32) {
    for (const car of this.cars) {
      if (car.frozen) continue;
      const dist = Math.hypot(car.x - originX, car.z - originZ);
      if (dist < radius) {
        car.panicTimer = 2.4;
      }
    }
  }

  public update(delta: number, playerX: number, playerZ: number, playerY: number) {
    const time = Date.now() * 0.005;

    this.cars.forEach((car) => {
      const mesh = this.carMeshes.get(car.id);
      if (!mesh) return;

      if (car.frozen) {
        return;
      }

      if (car.panicTimer && car.panicTimer > 0) {
        car.panicTimer = Math.max(0, car.panicTimer - delta);
      }

      // Check distance to player on ground (Superman standing in front or hero landing)
      const distToPlayer = Math.hypot(car.x - playerX, car.z - playerZ);
      const isPlayerBlocking = (distToPlayer < 8.5 && playerY < 4.5) || (car.panicTimer ?? 0) > 0;

      if (!isPlayerBlocking) {
        // Move through Bogotá's connected street grid and BRT corridor.
        const moveDist = car.speed * delta;
        if (car.lane === 'north-south') {
          car.z += moveDist * car.direction;
          if (car.z > 750) car.z = -750;
          if (car.z < -750) car.z = 750;
        } else {
          car.x += moveDist * car.direction;
          if (car.x > 750) car.x = -750;
          if (car.x < -750) car.x = 750;
        }
      }

      // Update mesh position
      mesh.position.set(car.x, car.y, car.z);

      // Flashing police siren
      if (car.type === 'police') {
        const siren = mesh.getObjectByName('police_siren') as THREE.Mesh;
        if (siren && siren.material instanceof THREE.MeshBasicMaterial) {
          const isRed = Math.sin(time * 3) > 0;
          siren.material.color.set(isRed ? 0xef4444 : 0x3b82f6);
        }
      }
    });
  }

  public freezeCar(carId: string) {
    const car = this.cars.find((c) => c.id === carId);
    if (car && !car.frozen) {
      car.frozen = true;
      const mesh = this.carMeshes.get(carId);
      if (mesh) {
        // Add ice crystal block over car
        const iceGeo = new THREE.BoxGeometry(3.6, 2.8, 5.8);
        const iceMat = new THREE.MeshStandardMaterial({
          color: 0x38bdf8,
          transparent: true,
          opacity: 0.65,
          roughness: 0.1,
          metalness: 0.2,
        });
        const iceMesh = new THREE.Mesh(iceGeo, iceMat);
        iceMesh.name = 'car_ice_block';
        iceMesh.position.y = 1.4;
        mesh.add(iceMesh);
      }
    }
  }

  public getNearestCar(x: number, y: number, z: number, maxDist: number = 20): TrafficCar | null {
    let nearest: TrafficCar | null = null;
    let minDist = maxDist;

    for (const car of this.cars) {
      const d = Math.hypot(car.x - x, car.z - z);
      if (d < minDist && Math.abs(car.y - y) < 8) {
        minDist = d;
        nearest = car;
      }
    }
    return nearest;
  }

  public getCarMesh(carId: string): THREE.Group | undefined {
    return this.carMeshes.get(carId);
  }

  public removeCar(carId: string) {
    const idx = this.cars.findIndex((c) => c.id === carId);
    let removedCar: TrafficCar | undefined;
    if (idx !== -1) {
      removedCar = this.cars[idx];
      this.cars.splice(idx, 1);
    }
    const mesh = this.carMeshes.get(carId);
    if (mesh) {
      this.carMeshes.delete(carId);
    }

    // Automatically respawn a replacement car far down the same avenue so traffic stays lively
    if (removedCar) {
      const axis = removedCar.lane === 'north-south' ? 'x' : 'z';
      const coord = axis === 'x' ? removedCar.x : removedCar.z;
      const respawnOffset = -removedCar.direction * (450 + Math.random() * 200);
      setTimeout(() => {
        this.spawnCarInLane(axis, coord, removedCar!.direction, respawnOffset);
      }, 4000);
    }
  }
}
