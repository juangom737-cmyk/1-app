import * as THREE from 'three';
import { Mission, EnemyEntity } from '../types/game';
import { audioService } from '../services/AudioService';

export interface UrbanProp {
  id: string;
  mesh: THREE.Mesh;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rotVx: number;
  rotVz: number;
}

export class CrimeManager {
  public missions: Mission[] = [];
  public activeMissionIndex: number = 0;
  public enemies: EnemyEntity[] = [];
  public urbanProps: UrbanProp[] = [];

  private scene: THREE.Scene;
  private missionGroup: THREE.Group;
  private propsGroup: THREE.Group;
  private shardsGroup: THREE.Group;
  private beaconMesh: THREE.Mesh | null = null;
  private enemyMeshes: Map<string, THREE.Group> = new Map();
  private frozenIceMeshes: Map<string, THREE.Mesh> = new Map();
  private iceShards: {
    mesh: THREE.Mesh;
    vx: number;
    vy: number;
    vz: number;
    rotVx: number;
    rotVz: number;
    life: number;
    maxLife: number;
  }[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.missionGroup = new THREE.Group();
    this.propsGroup = new THREE.Group();
    this.shardsGroup = new THREE.Group();
    this.scene.add(this.missionGroup);
    this.scene.add(this.propsGroup);
    this.scene.add(this.shardsGroup);

    this.initMissions();
    this.createBeacon();
    this.initUrbanProps();
    this.spawnMissionEntities(this.missions[0]);
  }

  private initMissions() {
    this.missions = [
      {
        id: 'mission_bank',
        type: 'bank-heist',
        title: 'Atraco Armado en el Banco Central',
        locationName: 'Distrito Financiero de Metrópolis',
        x: -80,
        y: 1.5,
        z: -90,
        description: 'Una banda armada con tecnología experimental está asaltando la bóveda principal del Banco Central.',
        objectiveText: 'Vuela al Banco y usa Visión Térmica o Golpe Sísmico para neutralizar a los asaltantes.',
        progress: 0,
        maxProgress: 4,
        rewardHope: 25,
        completed: false,
        active: true,
        iconColor: '#ef4444',
      },
      {
        id: 'mission_fire',
        type: 'skyscraper-fire',
        title: 'Incendio en la Torre LexCorp',
        locationName: 'Pisos Superiores de LexCorp Tower',
        x: 120,
        y: 110,
        z: -100,
        description: 'Una sobrecarga en el reactor de plasma causó un incendio masivo en el piso 42 de LexCorp.',
        objectiveText: 'Vuela hasta la altitud del fuego y usa tu Aliento Gélido para extinguir las 5 llamaradas.',
        progress: 0,
        maxProgress: 5,
        rewardHope: 30,
        completed: false,
        active: false,
        iconColor: '#f97316',
      },
      {
        id: 'mission_drones',
        type: 'lexcorp-drones',
        title: 'Incursión Aérea sobre el Daily Planet',
        locationName: 'Cielos de Downtown Metropolis',
        x: 0,
        y: 160,
        z: 0,
        description: 'Drones de combate no tripulados están amenazando la esfera del Daily Planet y el tráfico aéreo.',
        objectiveText: 'Intercepta los drones en pleno vuelo y destrúyelos con Visión Térmica.',
        progress: 0,
        maxProgress: 3,
        rewardHope: 25,
        completed: false,
        active: false,
        iconColor: '#06b6d4',
      },
      {
        id: 'mission_chase',
        type: 'car-chase',
        title: 'Persecución de Vehículo Blindado',
        locationName: 'Gran Avenida Centenario',
        x: 0,
        y: 1.5,
        z: 80,
        description: 'Un vehículo blindado de asalto huye a gran velocidad evadiendo las patrullas policiales.',
        objectiveText: 'Usa vuelo supersónico para interceptar el vehículo y congélalo con Aliento Gélido.',
        progress: 0,
        maxProgress: 1,
        rewardHope: 20,
        completed: false,
        active: false,
        iconColor: '#eab308',
      },
    ];
  }

  private createBeacon() {
    // 3D vertical light beam pointing from sky to mission
    const beaconGeo = new THREE.CylinderGeometry(1.2, 1.2, 300, 16);
    const beaconMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      transparent: true,
      opacity: 0.35,
    });
    this.beaconMesh = new THREE.Mesh(beaconGeo, beaconMat);
    this.missionGroup.add(this.beaconMesh);

    // Ground target circle
    const circleGeo = new THREE.RingGeometry(2, 6, 24);
    const circleMat = new THREE.MeshBasicMaterial({ color: 0xef4444, side: THREE.DoubleSide });
    const circle = new THREE.Mesh(circleGeo, circleMat);
    circle.rotation.x = -Math.PI / 2;
    circle.position.y = -149;
    this.beaconMesh.add(circle);
  }

  private initUrbanProps() {
    // Geometries for punchable destructible urban elements
    const dumpsterGeo = new THREE.BoxGeometry(2.4, 1.4, 1.6);
    const crateGeo = new THREE.BoxGeometry(1.4, 1.4, 1.4);
    const barrelGeo = new THREE.CylinderGeometry(0.55, 0.55, 1.3, 10);

    const dumpsterMat = new THREE.MeshStandardMaterial({ color: 0x065f46, roughness: 0.6, metalness: 0.5 });
    const crateMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.8 });
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.4, metalness: 0.6 });

    // Spawn 32 punchable props across downtown street corners & alleys
    const propCoords = [
      // Near bank and central plaza
      [-65, -75, 'dumpster'], [-95, -85, 'crate'], [-75, -105, 'barrel'],
      [-50, -60, 'crate'], [-85, -65, 'barrel'], [-60, -95, 'dumpster'],
      // Near Daily Planet
      [15, -15, 'dumpster'], [-20, 20, 'crate'], [25, 25, 'barrel'],
      [-15, -25, 'dumpster'], [30, -10, 'barrel'], [-25, 15, 'crate'],
      // Near LexCorp
      [105, -85, 'dumpster'], [135, -115, 'barrel'], [95, -110, 'crate'],
      [140, -85, 'barrel'], [110, -125, 'dumpster'],
      // Centennial Park perimeter
      [45, 75, 'crate'], [-45, 85, 'dumpster'], [65, 110, 'barrel'],
      [-30, 120, 'crate'], [50, 140, 'barrel'], [-55, 160, 'dumpster'],
      // South financial boulevard
      [-40, -145, 'dumpster'], [40, -155, 'barrel'], [0, -140, 'crate'],
      [-25, -170, 'barrel'], [35, -165, 'dumpster'],
    ];

    propCoords.forEach(([px, pz, type], idx) => {
      let geo: THREE.BufferGeometry = crateGeo;
      let mat = crateMat;
      let yOffset = 0.7;

      if (type === 'dumpster') {
        geo = dumpsterGeo;
        mat = dumpsterMat;
        yOffset = 0.7;
      } else if (type === 'barrel') {
        geo = barrelGeo;
        mat = barrelMat;
        yOffset = 0.65;
      }

      const mesh = new THREE.Mesh(geo, mat);
      const x = Number(px);
      const z = Number(pz);
      mesh.position.set(x, yOffset, z);
      this.propsGroup.add(mesh);

      this.urbanProps.push({
        id: `prop_${idx}`,
        mesh,
        x,
        y: yOffset,
        z,
        vx: 0,
        vy: 0,
        vz: 0,
        rotVx: 0,
        rotVz: 0,
      });
    });
  }

  public getActiveMission(): Mission {
    return this.missions[this.activeMissionIndex];
  }

  public switchMission(index: number) {
    if (index >= 0 && index < this.missions.length) {
      this.activeMissionIndex = index;
      this.missions.forEach((m, idx) => {
        m.active = idx === index;
      });
      this.spawnMissionEntities(this.missions[index]);
      audioService.playPoliceDispatch();
    }
  }

  private spawnMissionEntities(mission: Mission) {
    // Clear old enemies & ice statues
    this.enemies = [];
    this.enemyMeshes.forEach((mesh) => {
      this.missionGroup.remove(mesh);
    });
    this.enemyMeshes.clear();

    this.frozenIceMeshes.forEach((iceMesh) => {
      this.missionGroup.remove(iceMesh);
    });
    this.frozenIceMeshes.clear();

    // Position beacon
    if (this.beaconMesh) {
      this.beaconMesh.position.set(mission.x, mission.y + 150, mission.z);
      (this.beaconMesh.material as THREE.MeshBasicMaterial).color.set(mission.iconColor);
    }

    if (mission.type === 'bank-heist') {
      for (let i = 0; i < 4; i++) {
        const id = `thug_${i}`;
        const offsetAngle = (i / 4) * Math.PI * 2;
        const ex = mission.x + Math.cos(offsetAngle) * 8;
        const ez = mission.z + Math.sin(offsetAngle) * 8;

        this.enemies.push({
          id,
          type: 'thug',
          x: ex,
          y: 1.5,
          z: ez,
          health: 100,
          maxHealth: 100,
          active: true,
        });

        // 3D thug mesh (armed robber)
        const thugGroup = new THREE.Group();
        const bodyGeo = new THREE.CylinderGeometry(0.5, 0.4, 2, 8);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x334155 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 1;
        thugGroup.add(body);

        const headGeo = new THREE.SphereGeometry(0.35, 8, 8);
        const headMat = new THREE.MeshStandardMaterial({ color: 0x1e293b });
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.y = 2.3;
        thugGroup.add(head);

        // Gun
        const gunGeo = new THREE.BoxGeometry(0.2, 0.2, 0.8);
        const gunMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9 });
        const gun = new THREE.Mesh(gunGeo, gunMat);
        gun.position.set(0.5, 1.4, 0.5);
        thugGroup.add(gun);

        thugGroup.position.set(ex, 0, ez);
        this.missionGroup.add(thugGroup);
        this.enemyMeshes.set(id, thugGroup);
      }
    } else if (mission.type === 'skyscraper-fire') {
      for (let i = 0; i < 5; i++) {
        const id = `fire_${i}`;
        const fx = mission.x + (Math.random() - 0.5) * 20;
        const fy = mission.y + (Math.random() - 0.5) * 15;
        const fz = mission.z + (Math.random() - 0.5) * 20;

        this.enemies.push({
          id,
          type: 'fire',
          x: fx,
          y: fy,
          z: fz,
          health: 100,
          maxHealth: 100,
          active: true,
        });

        // Fire particle pillar
        const fireGroup = new THREE.Group();
        const fireGeo = new THREE.ConeGeometry(2.5, 6, 8);
        const fireMat = new THREE.MeshBasicMaterial({ color: 0xf97316 });
        const fireCone = new THREE.Mesh(fireGeo, fireMat);
        fireCone.position.y = 3;
        fireGroup.add(fireCone);

        fireGroup.position.set(fx, fy, fz);
        this.missionGroup.add(fireGroup);
        this.enemyMeshes.set(id, fireGroup);
      }
    } else if (mission.type === 'lexcorp-drones') {
      for (let i = 0; i < 3; i++) {
        const id = `drone_${i}`;
        const angle = (i / 3) * Math.PI * 2;
        const dx = mission.x + Math.cos(angle) * 35;
        const dz = mission.z + Math.sin(angle) * 35;

        this.enemies.push({
          id,
          type: 'drone',
          x: dx,
          y: mission.y,
          z: dz,
          health: 100,
          maxHealth: 100,
          active: true,
          speed: 18,
        });

        // Sci-fi drone mesh
        const droneGroup = new THREE.Group();
        const coreGeo = new THREE.SphereGeometry(1.4, 12, 12);
        const coreMat = new THREE.MeshStandardMaterial({
          color: 0x0f172a,
          metalness: 0.9,
          emissive: 0x06b6d4,
          emissiveIntensity: 0.6,
        });
        const core = new THREE.Mesh(coreGeo, coreMat);
        droneGroup.add(core);

        // Quad rotors
        const rotorGeo = new THREE.CylinderGeometry(1.2, 1.2, 0.1, 8);
        const rotorMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, wireframe: true });
        const r1 = new THREE.Mesh(rotorGeo, rotorMat);
        r1.position.set(-2, 0.4, 0);
        droneGroup.add(r1);
        const r2 = new THREE.Mesh(rotorGeo, rotorMat);
        r2.position.set(2, 0.4, 0);
        droneGroup.add(r2);

        droneGroup.position.set(dx, mission.y, dz);
        this.missionGroup.add(droneGroup);
        this.enemyMeshes.set(id, droneGroup);
      }
    } else if (mission.type === 'car-chase') {
      const id = 'getaway_car_1';
      this.enemies.push({
        id,
        type: 'getaway-car',
        x: mission.x,
        y: 1.5,
        z: mission.z,
        health: 100,
        maxHealth: 100,
        active: true,
        speed: 38,
      });

      const carGroup = new THREE.Group();
      const bodyGeo = new THREE.BoxGeometry(3.0, 1.6, 6.2);
      const bodyMat = new THREE.MeshStandardMaterial({ color: 0x111827, metalness: 0.8, roughness: 0.2 });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = 1;
      carGroup.add(body);

      carGroup.position.set(mission.x, 0, mission.z);
      this.missionGroup.add(carGroup);
      this.enemyMeshes.set(id, carGroup);
    }
  }

  private freezeEnemy(enemy: EnemyEntity, mesh: THREE.Group) {
    if (enemy.frozen) return;
    enemy.frozen = true;
    enemy.speed = 0;

    // Encase the enemy in a crystalline faceted ice statue
    let iceGeo: THREE.BufferGeometry;
    if (enemy.type === 'getaway-car') {
      iceGeo = new THREE.BoxGeometry(3.6, 2.2, 7.0);
    } else if (enemy.type === 'drone') {
      iceGeo = new THREE.DodecahedronGeometry(2.2);
    } else if (enemy.type === 'fire') {
      iceGeo = new THREE.ConeGeometry(3.2, 7, 8);
    } else {
      iceGeo = new THREE.BoxGeometry(1.6, 2.8, 1.6);
    }

    const iceMat = new THREE.MeshStandardMaterial({
      color: 0x93c5fd,
      roughness: 0.1,
      metalness: 0.25,
      transparent: true,
      opacity: 0.82,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.35,
    });

    const iceMesh = new THREE.Mesh(iceGeo, iceMat);
    const yOffset = enemy.type === 'fire' ? 3 : enemy.type === 'getaway-car' ? 1.0 : 1.35;
    iceMesh.position.set(enemy.x, enemy.y + yOffset, enemy.z);

    // Decorative ice crystals / frosted spikes on the statue
    const spikeGeo = new THREE.ConeGeometry(0.35, 1.2, 5);
    const spikeMat = new THREE.MeshBasicMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.9 });
    for (let s = 0; s < 4; s++) {
      const spike = new THREE.Mesh(spikeGeo, spikeMat);
      const angle = (s / 4) * Math.PI * 2;
      spike.position.set(Math.cos(angle) * 0.7, 1.2, Math.sin(angle) * 0.7);
      spike.rotation.z = (Math.random() - 0.5) * 0.5;
      iceMesh.add(spike);
    }

    this.missionGroup.add(iceMesh);
    this.frozenIceMeshes.set(enemy.id, iceMesh);
  }

  public shatterIceStatue(enemy: EnemyEntity, mesh?: THREE.Group, comboStep: number = 0): boolean {
    const iceMesh = this.frozenIceMeshes.get(enemy.id);
    if (iceMesh) {
      this.missionGroup.remove(iceMesh);
      this.frozenIceMeshes.delete(enemy.id);
    }

    // Play crisp crystalline ice shattering audio
    audioService.playIceShatter();

    // Spawn 18 breakable physics ice crystal fragments that blast in all directions!
    const shardGeo = new THREE.TetrahedronGeometry(0.42);
    const shardMat = new THREE.MeshStandardMaterial({
      color: 0xbae6fd,
      roughness: 0.12,
      metalness: 0.3,
      transparent: true,
      opacity: 0.88,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.4,
    });

    const shardCount = 20;
    const originY = enemy.y + 1.2;
    for (let k = 0; k < shardCount; k++) {
      const shard = new THREE.Mesh(shardGeo, shardMat);
      shard.position.set(
        enemy.x + (Math.random() - 0.5) * 1.0,
        originY + (Math.random() - 0.5) * 1.0,
        enemy.z + (Math.random() - 0.5) * 1.0
      );
      shard.scale.setScalar(0.6 + Math.random() * 0.8);
      this.shardsGroup.add(shard);

      const blastSpeed = 16 + Math.random() * 24 + comboStep * 8;
      const phi = Math.random() * Math.PI * 2;
      const theta = (Math.random() - 0.2) * Math.PI;

      this.iceShards.push({
        mesh: shard,
        vx: Math.cos(phi) * Math.sin(theta) * blastSpeed,
        vy: Math.abs(Math.cos(theta)) * blastSpeed * 0.8 + 6,
        vz: Math.sin(phi) * Math.sin(theta) * blastSpeed,
        rotVx: (Math.random() - 0.5) * 22,
        rotVz: (Math.random() - 0.5) * 22,
        life: 1.4,
        maxLife: 1.4,
      });
    }

    // Defeat enemy instantly
    enemy.health = 0;
    enemy.active = false;
    if (mesh) {
      this.missionGroup.remove(mesh);
      this.enemyMeshes.delete(enemy.id);
    }

    const mission = this.getActiveMission();
    mission.progress += 1;
    if (mission.progress >= mission.maxProgress) {
      mission.completed = true;
      audioService.playMissionSuccess();
      setTimeout(() => {
        const nextIdx = (this.activeMissionIndex + 1) % this.missions.length;
        this.switchMission(nextIdx);
      }, 3500);
      return true;
    }
    return false;
  }

  public update(
    delta: number,
    playerX: number,
    playerY: number,
    playerZ: number,
    isFiringHeat: boolean,
    isFiringFreeze: boolean,
    playerPower: string | null
  ): { missionCompleted: boolean; progressGained: number } {
    let progressGained = 0;
    let missionCompleted = false;
    const mission = this.getActiveMission();

    // Pulse beacon
    if (this.beaconMesh) {
      this.beaconMesh.rotation.y += delta * 1.5;
    }

    // Animate enemies & check damage from Superman
    this.enemies.forEach((enemy) => {
      if (!enemy.active) return;
      const mesh = this.enemyMeshes.get(enemy.id);
      if (!mesh) return;

      // Distance to Superman
      const dist = Math.hypot(enemy.x - playerX, enemy.y - playerY, enemy.z - playerZ);

      // Behavior updates (only if NOT frozen into an ice statue)
      if (!enemy.frozen) {
        if (enemy.type === 'drone') {
          const time = Date.now() * 0.001;
          enemy.x = mission.x + Math.cos(time + parseInt(enemy.id.split('_')[1] || '0') * 2) * 35;
          enemy.z = mission.z + Math.sin(time + parseInt(enemy.id.split('_')[1] || '0') * 2) * 35;
          mesh.position.set(enemy.x, enemy.y, enemy.z);
          mesh.rotation.y += delta * 3;
        } else if (enemy.type === 'getaway-car') {
          enemy.z -= (enemy.speed || 30) * delta;
          if (enemy.z < -300) enemy.z = 300;
          mesh.position.set(enemy.x, enemy.y, enemy.z);
        } else if (enemy.type === 'fire') {
          // Flickering fire
          mesh.scale.y = 1.0 + Math.sin(Date.now() * 0.01 + enemy.x) * 0.3;
        }
      }

      // Check hit from Heat Vision (beam hits when within 90m and roughly in front)
      if (isFiringHeat && dist < 90) {
        enemy.health -= delta * 140;
        if (mesh.children[0] && (mesh.children[0] as THREE.Mesh).material) {
          ((mesh.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial).color?.setHex(0xffffff);
        }
        // Heat melts ice if frozen
        if (enemy.frozen) {
          const iceMesh = this.frozenIceMeshes.get(enemy.id);
          if (iceMesh) {
            this.missionGroup.remove(iceMesh);
            this.frozenIceMeshes.delete(enemy.id);
          }
          enemy.frozen = false;
        }
      }

      // Check hit from Freeze Breath (dense blizzard cone within 32m)
      if (isFiringFreeze && dist < 32) {
        enemy.health -= delta * 90;
        enemy.freezeProgress = (enemy.freezeProgress || 0) + delta * 160;

        // When sub-zero threshold is reached: Freeze into solid ice statue!
        if (enemy.freezeProgress >= 70 && !enemy.frozen) {
          this.freezeEnemy(enemy, mesh);
        }
      }

      // Check defeat (via heat or direct extinction)
      if (enemy.health <= 0 && enemy.active) {
        enemy.active = false;
        mission.progress += 1;
        progressGained += 1;

        // Clean up meshes
        this.missionGroup.remove(mesh);
        this.enemyMeshes.delete(enemy.id);
        const iceMesh = this.frozenIceMeshes.get(enemy.id);
        if (iceMesh) {
          this.missionGroup.remove(iceMesh);
          this.frozenIceMeshes.delete(enemy.id);
        }

        if (mission.progress >= mission.maxProgress) {
          mission.completed = true;
          missionCompleted = true;
          audioService.playMissionSuccess();
          setTimeout(() => {
            const nextIdx = (this.activeMissionIndex + 1) % this.missions.length;
            this.switchMission(nextIdx);
          }, 3500);
        }
      }
    });

    // Update urban props physics (gravity, bouncing, friction)
    for (let i = 0; i < this.urbanProps.length; i++) {
      const prop = this.urbanProps[i];
      if (Math.abs(prop.vx) > 0.05 || Math.abs(prop.vy) > 0.05 || Math.abs(prop.vz) > 0.05) {
        prop.vy -= 36 * delta; // Gravity
        prop.x += prop.vx * delta;
        prop.y += prop.vy * delta;
        prop.z += prop.vz * delta;

        prop.mesh.rotation.x += prop.rotVx * delta;
        prop.mesh.rotation.z += prop.rotVz * delta;

        // Ground collision & bouncing
        if (prop.y <= 0.7) {
          prop.y = 0.7;
          prop.vy = -prop.vy * 0.35;
          prop.vx *= 0.65;
          prop.vz *= 0.65;
          prop.rotVx *= 0.6;
          prop.rotVz *= 0.6;
          if (Math.abs(prop.vy) < 1.0) prop.vy = 0;
        }

        prop.mesh.position.set(prop.x, prop.y, prop.z);
      }
    }

    // Update breakable ice crystal fragments physics
    for (let s = this.iceShards.length - 1; s >= 0; s--) {
      const shard = this.iceShards[s];
      shard.life -= delta;
      if (shard.life <= 0) {
        this.shardsGroup.remove(shard.mesh);
        this.iceShards.splice(s, 1);
        continue;
      }

      shard.vy -= 32 * delta; // Gravity
      shard.mesh.position.x += shard.vx * delta;
      shard.mesh.position.y += shard.vy * delta;
      shard.mesh.position.z += shard.vz * delta;

      shard.mesh.rotation.x += shard.rotVx * delta;
      shard.mesh.rotation.z += shard.rotVz * delta;

      // Ground bounce
      if (shard.mesh.position.y <= 0.3) {
        shard.mesh.position.y = 0.3;
        shard.vy = -shard.vy * 0.4;
        shard.vx *= 0.7;
        shard.vz *= 0.7;
      }

      // Shrink scale smoothly as life fades
      const scale = Math.max(0.01, shard.life / shard.maxLife);
      shard.mesh.scale.setScalar(scale);
    }

    return { missionCompleted, progressGained };
  }

  public handlePunchHit(
    playerX: number,
    playerY: number,
    playerZ: number,
    rotY: number,
    comboStep: number = 0
  ): { hits: number; propsHit: number; iceShattered: number; missionCompleted: boolean } {
    let hits = 0;
    let propsHit = 0;
    let iceShattered = 0;
    let missionCompleted = false;
    const mission = this.getActiveMission();

    // Superman forward heading vector (away from camera into scene)
    const dirX = Math.sin(rotY);
    const dirZ = Math.cos(rotY);

    // Punch enemies within cone (reach: 8.0m, vertical delta: 4.8m)
    this.enemies.forEach((enemy) => {
      if (!enemy.active) return;
      const dx = enemy.x - playerX;
      const dy = enemy.y - playerY;
      const dz = enemy.z - playerZ;
      const dist = Math.hypot(dx, dz);

      if (dist < 8.2 && Math.abs(dy) < 4.8) {
        const normDx = dx / (dist || 1);
        const normDz = dz / (dist || 1);
        const dot = normDx * dirX + normDz * dirZ;

        if (dot > 0.08) {
          hits++;
          const mesh = this.enemyMeshes.get(enemy.id);

          // BREAKABLE ICE STATUE MECHANIC:
          // If the enemy is frozen, a punch SHATTERS the statue into exploding ice crystals!
          if (enemy.frozen) {
            iceShattered++;
            const completed = this.shatterIceStatue(enemy, mesh, comboStep);
            if (completed) missionCompleted = true;
            return;
          }

          const damage = comboStep === 2 ? 180 : 120;
          enemy.health -= damage;

          // Physics knockback impulse
          const knockPower = comboStep === 2 ? 18 : 10;
          enemy.x += dirX * knockPower;
          enemy.z += dirZ * knockPower;

          if (mesh) {
            mesh.position.set(enemy.x, enemy.y, enemy.z);
            if (mesh.children[0] && (mesh.children[0] as THREE.Mesh).material) {
              ((mesh.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial).color?.setHex(0xffffff);
            }
          }

          if (enemy.health <= 0 && enemy.active) {
            enemy.active = false;
            mission.progress += 1;
            if (mesh) {
              this.missionGroup.remove(mesh);
              this.enemyMeshes.delete(enemy.id);
            }
            if (mission.progress >= mission.maxProgress) {
              mission.completed = true;
              missionCompleted = true;
              audioService.playMissionSuccess();
              setTimeout(() => {
                const nextIdx = (this.activeMissionIndex + 1) % this.missions.length;
                this.switchMission(nextIdx);
              }, 3500);
            }
          }
        }
      }
    });

    // Punch urban props with massive superhero force impulse!
    this.urbanProps.forEach((prop) => {
      const dx = prop.x - playerX;
      const dy = prop.y - playerY;
      const dz = prop.z - playerZ;
      const dist = Math.hypot(dx, dz);

      if (dist < 7.5 && Math.abs(dy) < 4.0) {
        const normDx = dx / (dist || 1);
        const normDz = dz / (dist || 1);
        const dot = normDx * dirX + normDz * dirZ;

        if (dot > 0.12) {
          propsHit++;
          const force = comboStep === 2 ? 58 : 38;
          prop.vx = dirX * force + (Math.random() - 0.5) * 8;
          prop.vy = comboStep === 2 ? 20 : 12;
          prop.vz = dirZ * force + (Math.random() - 0.5) * 8;
          prop.rotVx = (Math.random() - 0.5) * 18;
          prop.rotVz = (Math.random() - 0.5) * 18;
        }
      }
    });

    // Sound feedback
    audioService.playSuperPunch(comboStep);
    if (propsHit > 0) {
      audioService.playHeavyImpact();
    }

    return { hits, propsHit, iceShattered, missionCompleted };
  }

  public handleGroundSlamHit(playerX: number, playerZ: number, radius: number = 24) {
    let hits = 0;

    this.enemies.forEach((enemy) => {
      if (!enemy.active) return;
      const d = Math.hypot(enemy.x - playerX, enemy.z - playerZ);
      if (d < radius && enemy.type !== 'drone') {
        const mesh = this.enemyMeshes.get(enemy.id);
        if (enemy.frozen) {
          this.shatterIceStatue(enemy, mesh, 2);
        } else {
          enemy.health -= 120; // Instantly knock out thugs or extinguish fires on ground
        }
        hits++;
      }
    });
    return hits;
  }

  public getEnemies(): EnemyEntity[] {
    return this.enemies.filter((e) => e.active);
  }

  public getEnemyMesh(id: string): THREE.Group | undefined {
    return this.enemyMeshes.get(id);
  }

  public damageEnemy(id: string, damage: number, origin: THREE.Vector3): boolean {
    const enemy = this.enemies.find((e) => e.id === id);
    if (!enemy || !enemy.active) return false;

    enemy.health -= damage;
    const mesh = this.enemyMeshes.get(id);

    // Apply knockback
    const dx = enemy.x - origin.x;
    const dz = enemy.z - origin.z;
    const len = Math.hypot(dx, dz) || 1;
    enemy.x += (dx / len) * 8.0;
    enemy.z += (dz / len) * 8.0;

    if (mesh) {
      mesh.position.set(enemy.x, enemy.y, enemy.z);
    }

    if (enemy.health <= 0) {
      enemy.active = false;
      const mission = this.getActiveMission();
      mission.progress += 1;
      if (mesh) {
        this.missionGroup.remove(mesh);
        this.enemyMeshes.delete(id);
      }
      if (mission.progress >= mission.maxProgress) {
        mission.completed = true;
        audioService.playMissionSuccess();
        setTimeout(() => {
          const nextIdx = (this.activeMissionIndex + 1) % this.missions.length;
          this.switchMission(nextIdx);
        }, 3500);
      }
      return true;
    }
    return false;
  }
}
