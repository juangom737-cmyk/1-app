import * as THREE from 'three';
import { TrafficCar } from '../types/game';

export class TrafficSystem {
  public cars: TrafficCar[] = [];
  private carMeshes: Map<string, THREE.Group> = new Map();
  private sceneGroup: THREE.Group;

  constructor(scene: THREE.Scene) {
    this.sceneGroup = new THREE.Group();
    scene.add(this.sceneGroup);
    this.initCars();
  }

  private initCars() {
    const lanes = [
      { axis: 'x', coord: -90, dir: 1 },
      { axis: 'x', coord: -30, dir: -1 },
      { axis: 'x', coord: 30, dir: 1 },
      { axis: 'x', coord: 90, dir: -1 },
      { axis: 'z', coord: -90, dir: 1 },
      { axis: 'z', coord: -30, dir: -1 },
      { axis: 'z', coord: 30, dir: 1 },
      { axis: 'z', coord: 90, dir: -1 },
    ];

    let idCounter = 1;
    lanes.forEach((lane) => {
      for (let i = 0; i < 4; i++) {
        const id = `car_${idCounter++}`;
        const typeRand = Math.random();
        const type: TrafficCar['type'] =
          typeRand < 0.35 ? 'taxi' : typeRand < 0.55 ? 'police' : typeRand < 0.85 ? 'sedan' : 'truck';

        const color =
          type === 'taxi'
            ? '#eab308'
            : type === 'police'
            ? '#0f172a'
            : type === 'truck'
            ? '#334155'
            : ['#ef4444', '#3b82f6', '#e2e8f0', '#10b981'][Math.floor(Math.random() * 4)];

        const offset = -280 + i * 140 + (Math.random() - 0.5) * 30;

        const carData: TrafficCar = {
          id,
          x: lane.axis === 'z' ? offset : lane.coord,
          y: 0.8,
          z: lane.axis === 'x' ? offset : lane.coord,
          rotationY: lane.axis === 'x' ? (lane.dir === 1 ? 0 : Math.PI) : lane.dir === 1 ? Math.PI / 2 : -Math.PI / 2,
          speed: 16 + Math.random() * 8,
          color,
          type,
          lane: lane.axis === 'x' ? 'north-south' : 'east-west',
          direction: lane.dir as 1 | -1,
          frozen: false,
        };

        this.cars.push(carData);
        this.createCarMesh(carData);
      }
    });
  }

  private createCarMesh(car: TrafficCar) {
    const carGroup = new THREE.Group();

    // Body dimensions
    const isTruck = car.type === 'truck';
    const width = isTruck ? 3.2 : 2.4;
    const height = isTruck ? 2.6 : 1.3;
    const length = isTruck ? 6.5 : 4.6;

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

    // Cabin
    const cabinGeo = new THREE.BoxGeometry(width * 0.85, height * 0.5, length * 0.55);
    const cabinMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.1,
      metalness: 0.9,
    });
    const cabin = new THREE.Mesh(cabinGeo, cabinMat);
    cabin.position.set(0, height * 0.7 + 0.2, -length * 0.05);
    carGroup.add(cabin);

    // Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.4, 12);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9 });
    const wheelPositions = [
      [-width / 2, 0.4, -length * 0.3],
      [width / 2, 0.4, -length * 0.3],
      [-width / 2, 0.4, length * 0.3],
      [width / 2, 0.4, length * 0.3],
    ];

    wheelPositions.forEach(([wx, wy, wz]) => {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(wx, wy, wz);
      carGroup.add(wheel);
    });

    // Headlights
    const lightGeo = new THREE.SphereGeometry(0.25, 8, 8);
    const headMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
    const leftHead = new THREE.Mesh(lightGeo, headMat);
    leftHead.position.set(-width * 0.35, height * 0.4, length * 0.5);
    const rightHead = new THREE.Mesh(lightGeo, headMat);
    rightHead.position.set(width * 0.35, height * 0.4, length * 0.5);
    carGroup.add(leftHead);
    carGroup.add(rightHead);

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

  public update(delta: number, playerX: number, playerZ: number, playerY: number) {
    const time = Date.now() * 0.005;

    this.cars.forEach((car) => {
      const mesh = this.carMeshes.get(car.id);
      if (!mesh) return;

      if (car.frozen) {
        // Frozen cars don't move and have ice sheen
        return;
      }

      // Check distance to player on ground (Superman standing in front)
      const distToPlayer = Math.hypot(car.x - playerX, car.z - playerZ);
      const isPlayerBlocking = distToPlayer < 7 && playerY < 4;

      if (!isPlayerBlocking) {
        // Move along direction across expanded Metropolis avenues
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
    if (idx !== -1) {
      this.cars.splice(idx, 1);
    }
    const mesh = this.carMeshes.get(carId);
    if (mesh) {
      if (mesh.parent) mesh.parent.remove(mesh);
      this.carMeshes.delete(carId);
    }
  }
}
