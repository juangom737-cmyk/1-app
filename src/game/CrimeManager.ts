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

interface BulletTracer {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  isPlasma?: boolean;
}

interface DeflectionSpark {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
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
  private combatVfxGroup: THREE.Group;
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

  // Combat AI & Projectile state
  private bulletTracers: BulletTracer[] = [];
  private deflectionSparks: DeflectionSpark[] = [];
  private thugShootTimers: Map<string, number> = new Map();
  private thugMuzzleFlashTimers: Map<string, number> = new Map();
  private droneShootTimers: Map<string, number> = new Map();
  private lastRicochetSoundTime: number = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.missionGroup = new THREE.Group();
    this.propsGroup = new THREE.Group();
    this.shardsGroup = new THREE.Group();
    this.combatVfxGroup = new THREE.Group();

    this.scene.add(this.missionGroup);
    this.scene.add(this.propsGroup);
    this.scene.add(this.shardsGroup);
    this.scene.add(this.combatVfxGroup);

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
        y: 0.0,
        z: -90,
        description: 'Una célula fuertemente armada está asaltando la cámara de seguridad con tecnología militar experimental.',
        objectiveText: 'Neutraliza a los asaltantes armados usando Visión Térmica, Aliento Gélido o Combate Kriptoniano.',
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
        objectiveText: 'Intercepta los drones en pleno vuelo y destrúyelos con Visión Térmica o embestidas Mach.',
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
        y: 0.8,
        z: 80,
        description: 'Un todoterreno blindado de escape huye a gran velocidad evadiendo los bloqueos policiales.',
        objectiveText: 'Usa vuelo supersónico para interceptar el vehículo y congélalo con Aliento Gélido o arrójalo.',
        progress: 0,
        maxProgress: 1,
        rewardHope: 35,
        completed: false,
        active: false,
        iconColor: '#a855f7',
      },
    ];
  }

  private createBeacon() {
    const beaconGeo = new THREE.CylinderGeometry(1.2, 12, 140, 16, 1, true);
    beaconGeo.translate(0, 70, 0);
    const beaconMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.beaconMesh = new THREE.Mesh(beaconGeo, beaconMat);
    this.scene.add(this.beaconMesh);
  }

  private initUrbanProps() {
    // Street dumpsters, newspaper stands, mailboxes, and phone booths
    const propConfigs = [
      { type: 'dumpster', count: 14, color: 0x15803d, w: 2.2, h: 1.5, d: 1.4 },
      { type: 'stand', count: 18, color: 0x0284c7, w: 1.4, h: 2.2, d: 1.2 },
      { type: 'mailbox', count: 24, color: 0x1d4ed8, w: 0.8, h: 1.4, d: 0.8 },
      { type: 'crate', count: 16, color: 0xa16207, w: 1.2, h: 1.2, d: 1.2 },
    ];

    let propId = 0;
    propConfigs.forEach((cfg) => {
      const geo = new THREE.BoxGeometry(cfg.w, cfg.h, cfg.d);
      const mat = new THREE.MeshStandardMaterial({
        color: cfg.color,
        roughness: 0.7,
        metalness: 0.2,
      });

      for (let i = 0; i < cfg.count; i++) {
        const id = `prop_${propId++}`;
        const mesh = new THREE.Mesh(geo, mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        const x = (Math.random() - 0.5) * 440;
        const z = (Math.random() - 0.5) * 440;
        const y = cfg.h / 2;

        mesh.position.set(x, y, z);
        mesh.rotation.y = Math.random() * Math.PI * 2;
        this.propsGroup.add(mesh);

        this.urbanProps.push({
          id,
          mesh,
          x,
          y,
          z,
          vx: 0,
          vy: 0,
          vz: 0,
          rotVx: 0,
          rotVz: 0,
        });
      }
    });
  }

  /**
   * Builds an anatomically realistic humanoid mercenary / bank robber (1.82m height)
   * Grounded with boots touching pavement at y = 0.0, tactical vest, balaclava with red visor,
   * assault rifle with red laser sight and muzzle flash.
   */
  private createThugMesh(): THREE.Group {
    const thugGroup = new THREE.Group();

    // Attire Materials
    const camoPantsMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7 });
    const combatBootMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.8 });
    const armorVestMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6, metalness: 0.25 });
    const maskMat = new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.8 });
    const redVisorMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    const weaponMat = new THREE.MeshStandardMaterial({ color: 0x020617, roughness: 0.35, metalness: 0.85 });

    // 1. Tactical Combat Boots (Grounded at y = 0.0)
    const bootGeo = new THREE.BoxGeometry(0.13, 0.08, 0.24);
    const leftBoot = new THREE.Mesh(bootGeo, combatBootMat);
    leftBoot.position.set(-0.13, 0.04, 0.02);
    leftBoot.castShadow = true;
    thugGroup.add(leftBoot);

    const rightBoot = new THREE.Mesh(bootGeo, combatBootMat);
    rightBoot.position.set(0.13, 0.04, 0.02);
    rightBoot.castShadow = true;
    thugGroup.add(rightBoot);

    // 2. Articulated Legs & Knee Armor (y = 0.08 to 0.82)
    const legGeo = new THREE.CylinderGeometry(0.08, 0.07, 0.74, 8);
    const leftLeg = new THREE.Mesh(legGeo, camoPantsMat);
    leftLeg.position.set(-0.13, 0.44, 0);
    leftLeg.castShadow = true;
    thugGroup.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, camoPantsMat);
    rightLeg.position.set(0.13, 0.44, 0);
    rightLeg.castShadow = true;
    thugGroup.add(rightLeg);

    const kneePadGeo = new THREE.BoxGeometry(0.12, 0.12, 0.06);
    const leftPad = new THREE.Mesh(kneePadGeo, combatBootMat);
    leftPad.position.set(-0.13, 0.44, 0.08);
    thugGroup.add(leftPad);

    const rightPad = new THREE.Mesh(kneePadGeo, combatBootMat);
    rightPad.position.set(0.13, 0.44, 0.08);
    thugGroup.add(rightPad);

    // 3. Torso & Armored Kevlar Vest (y = 0.82 to 1.38)
    const vestGeo = new THREE.BoxGeometry(0.42, 0.56, 0.28);
    const vest = new THREE.Mesh(vestGeo, armorVestMat);
    vest.position.y = 1.12;
    vest.castShadow = true;
    thugGroup.add(vest);

    // Ammo Pouches on chest
    const pouchGeo = new THREE.BoxGeometry(0.09, 0.14, 0.06);
    for (let p = -1; p <= 1; p++) {
      const pouch = new THREE.Mesh(pouchGeo, camoPantsMat);
      pouch.position.set(p * 0.12, 1.08, 0.16);
      thugGroup.add(pouch);
    }

    // 4. Balaclava Head with Night-Vision Glowing Visor (y = 1.42 to 1.76)
    const headGeo = new THREE.SphereGeometry(0.13, 10, 10);
    const head = new THREE.Mesh(headGeo, maskMat);
    head.position.y = 1.56;
    head.castShadow = true;
    thugGroup.add(head);

    const visorGeo = new THREE.BoxGeometry(0.18, 0.06, 0.08);
    const visor = new THREE.Mesh(visorGeo, redVisorMat);
    visor.position.set(0, 1.58, 0.11);
    thugGroup.add(visor);

    // 5. Dual Articulated Arms holding Assault Rifle aimed forward
    const armGeo = new THREE.CylinderGeometry(0.06, 0.05, 0.55, 8);
    armGeo.rotateX(Math.PI / 2.3);

    const leftArm = new THREE.Mesh(armGeo, armorVestMat);
    leftArm.position.set(-0.22, 1.25, 0.22);
    leftArm.rotation.y = 0.35;
    thugGroup.add(leftArm);

    const rightArm = new THREE.Mesh(armGeo, armorVestMat);
    rightArm.position.set(0.22, 1.25, 0.22);
    rightArm.rotation.y = -0.35;
    thugGroup.add(rightArm);

    // Tactical Assault Rifle
    const rifleGroup = new THREE.Group();
    rifleGroup.name = 'rifle';
    rifleGroup.position.set(0.08, 1.22, 0.35);

    const receiverGeo = new THREE.BoxGeometry(0.08, 0.12, 0.52);
    const receiver = new THREE.Mesh(receiverGeo, weaponMat);
    rifleGroup.add(receiver);

    const barrelGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.45, 8);
    barrelGeo.rotateX(Math.PI / 2);
    const barrel = new THREE.Mesh(barrelGeo, weaponMat);
    barrel.position.set(0, 0.02, 0.42);
    rifleGroup.add(barrel);

    // Curved Magazine
    const magGeo = new THREE.BoxGeometry(0.05, 0.18, 0.1);
    const mag = new THREE.Mesh(magGeo, combatBootMat);
    mag.position.set(0, -0.12, 0.08);
    mag.rotation.x = -0.2;
    rifleGroup.add(mag);

    // Red Laser Targeting Sight Line
    const laserSightGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0.02, 0.65),
      new THREE.Vector3(0, 0.02, 16.0),
    ]);
    const laserSightMat = new THREE.LineBasicMaterial({
      color: 0xef4444,
      transparent: true,
      opacity: 0.75,
    });
    const laserSight = new THREE.Line(laserSightGeo, laserSightMat);
    laserSight.name = 'laserSight';
    rifleGroup.add(laserSight);

    // Muzzle Flash Flare
    const flashGeo = new THREE.SphereGeometry(0.16, 6, 6);
    const flashMat = new THREE.MeshBasicMaterial({
      color: 0xffaa00,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
    });
    const muzzleFlash = new THREE.Mesh(flashGeo, flashMat);
    muzzleFlash.position.set(0, 0.02, 0.68);
    muzzleFlash.name = 'muzzleFlash';
    rifleGroup.add(muzzleFlash);

    thugGroup.add(rifleGroup);

    return thugGroup;
  }

  /**
   * Builds an optimized, high-tech LexCorp aerial combat drone (1.6m wide)
   */
  private createDroneMesh(): THREE.Group {
    const droneGroup = new THREE.Group();

    // Central chassis
    const coreGeo = new THREE.SphereGeometry(0.48, 12, 12);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.95,
      roughness: 0.2,
      emissive: 0x06b6d4,
      emissiveIntensity: 0.7,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    droneGroup.add(core);

    // Quad rotor arms & carbon fiber shrouds
    const armGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.4, 8);
    armGeo.rotateZ(Math.PI / 2);
    const armMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8 });
    const arm1 = new THREE.Mesh(armGeo, armMat);
    arm1.rotation.y = Math.PI / 4;
    droneGroup.add(arm1);
    const arm2 = new THREE.Mesh(armGeo, armMat);
    arm2.rotation.y = -Math.PI / 4;
    droneGroup.add(arm2);

    // Spinning rotor discs
    const rotorGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.02, 12);
    const rotorMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.75,
      wireframe: true,
    });

    const rotorPositions = [
      [-0.6, 0.12, -0.6],
      [0.6, 0.12, -0.6],
      [-0.6, 0.12, 0.6],
      [0.6, 0.12, 0.6],
    ];

    rotorPositions.forEach((pos) => {
      const rotor = new THREE.Mesh(rotorGeo, rotorMat);
      rotor.position.set(pos[0], pos[1], pos[2]);
      rotor.name = 'rotor';
      droneGroup.add(rotor);
    });

    // Red targeting searchlight
    const lightConeGeo = new THREE.ConeGeometry(0.8, 8, 8, 1, true);
    lightConeGeo.rotateX(Math.PI);
    lightConeGeo.translate(0, -4, 0);
    const lightConeMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const searchlight = new THREE.Mesh(lightConeGeo, lightConeMat);
    droneGroup.add(searchlight);

    return droneGroup;
  }

  private spawnMissionEntities(mission: Mission) {
    // Clear old mission meshes
    this.enemyMeshes.forEach((mesh) => {
      this.missionGroup.remove(mesh);
    });
    this.enemyMeshes.clear();
    this.enemies = [];

    this.frozenIceMeshes.forEach((ice) => {
      this.missionGroup.remove(ice);
    });
    this.frozenIceMeshes.clear();

    // Position beacon
    if (this.beaconMesh) {
      this.beaconMesh.position.set(mission.x, mission.y + 150, mission.z);
      (this.beaconMesh.material as THREE.MeshBasicMaterial).color.set(mission.iconColor);
    }

    if (mission.type === 'bank-heist') {
      // Spawn Armored Getaway Van near the Bank Steps
      const vanGroup = new THREE.Group();
      const vanChassisGeo = new THREE.BoxGeometry(2.6, 1.8, 5.4);
      const vanMat = new THREE.MeshStandardMaterial({ color: 0x111827, metalness: 0.6, roughness: 0.4 });
      const vanChassis = new THREE.Mesh(vanChassisGeo, vanMat);
      vanChassis.position.y = 1.0;
      vanChassis.castShadow = true;
      vanGroup.add(vanChassis);

      // Warning red siren on top
      const sirenGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.1, 8);
      const sirenMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
      const siren = new THREE.Mesh(sirenGeo, sirenMat);
      siren.position.set(0, 1.95, 0);
      vanGroup.add(siren);

      vanGroup.position.set(mission.x - 12, 0, mission.z + 4);
      vanGroup.rotation.y = 0.4;
      this.missionGroup.add(vanGroup);

      // Spawn 4 Armored Thugs surrounding the vault entrance (strictly grounded at y = 0.0)
      for (let i = 0; i < 4; i++) {
        const id = `thug_${i}`;
        const offsetAngle = (i / 4) * Math.PI * 2;
        const ex = mission.x + Math.cos(offsetAngle) * 7;
        const ez = mission.z + Math.sin(offsetAngle) * 7;

        this.enemies.push({
          id,
          type: 'thug',
          x: ex,
          y: 0.0,
          z: ez,
          health: 100,
          maxHealth: 100,
          active: true,
        });

        const thugMesh = this.createThugMesh();
        thugMesh.position.set(ex, 0, ez);
        thugMesh.rotation.y = offsetAngle + Math.PI;

        this.missionGroup.add(thugMesh);
        this.enemyMeshes.set(id, thugMesh);
      }
    } else if (mission.type === 'skyscraper-fire') {
      for (let i = 0; i < 5; i++) {
        const id = `fire_${i}`;
        const fx = mission.x + (Math.random() - 0.5) * 22;
        const fy = mission.y + (Math.random() - 0.5) * 16;
        const fz = mission.z + (Math.random() - 0.5) * 22;

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

        // Multi-tiered animated volumetric fire pillar
        const fireGroup = new THREE.Group();
        const coreFireGeo = new THREE.ConeGeometry(2.0, 5.5, 8);
        const coreFireMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
        const coreCone = new THREE.Mesh(coreFireGeo, coreFireMat);
        coreCone.position.y = 2.75;
        fireGroup.add(coreCone);

        const outerFireGeo = new THREE.ConeGeometry(3.2, 7.5, 8);
        const outerFireMat = new THREE.MeshBasicMaterial({
          color: 0xf97316,
          transparent: true,
          opacity: 0.75,
          blending: THREE.AdditiveBlending,
        });
        const outerCone = new THREE.Mesh(outerFireGeo, outerFireMat);
        outerCone.position.y = 3.5;
        fireGroup.add(outerCone);

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

        const droneMesh = this.createDroneMesh();
        droneMesh.position.set(dx, mission.y, dz);
        this.missionGroup.add(droneMesh);
        this.enemyMeshes.set(id, droneMesh);
      }
    } else if (mission.type === 'car-chase') {
      const id = 'getaway_car_1';
      this.enemies.push({
        id,
        type: 'getaway-car',
        x: mission.x,
        y: 0.8,
        z: mission.z,
        health: 100,
        maxHealth: 100,
        active: true,
        speed: 38,
      });

      const carGroup = new THREE.Group();
      const bodyGeo = new THREE.BoxGeometry(2.4, 1.4, 5.0);
      const bodyMat = new THREE.MeshStandardMaterial({
        color: 0x09090b,
        metalness: 0.85,
        roughness: 0.25,
      });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = 0.85;
      body.castShadow = true;
      carGroup.add(body);

      // Flashing underglow
      const underglowGeo = new THREE.PlaneGeometry(2.2, 4.6);
      underglowGeo.rotateX(-Math.PI / 2);
      const underglowMat = new THREE.MeshBasicMaterial({
        color: 0xa855f7,
        transparent: true,
        opacity: 0.65,
      });
      const underglow = new THREE.Mesh(underglowGeo, underglowMat);
      underglow.position.y = 0.15;
      carGroup.add(underglow);

      carGroup.position.set(mission.x, 0, mission.z);
      this.missionGroup.add(carGroup);
      this.enemyMeshes.set(id, carGroup);
    }
  }

  private freezeEnemy(enemy: EnemyEntity, mesh: THREE.Group) {
    if (enemy.frozen) return;
    enemy.frozen = true;
    enemy.speed = 0;

    let iceGeo: THREE.BufferGeometry;
    let yOffset = 0.95;

    if (enemy.type === 'getaway-car') {
      iceGeo = new THREE.BoxGeometry(3.0, 1.8, 5.6);
      yOffset = 0.9;
    } else if (enemy.type === 'drone') {
      iceGeo = new THREE.DodecahedronGeometry(1.6);
      yOffset = 0;
    } else if (enemy.type === 'fire') {
      iceGeo = new THREE.ConeGeometry(3.0, 7.5, 8);
      yOffset = 3.5;
    } else {
      // Humanoid Thug Statue (1.82m)
      iceGeo = new THREE.BoxGeometry(0.85, 1.85, 0.85);
      yOffset = 0.92;
    }

    const iceMat = new THREE.MeshStandardMaterial({
      color: 0x93c5fd,
      roughness: 0.1,
      metalness: 0.25,
      transparent: true,
      opacity: 0.85,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.35,
    });

    const iceMesh = new THREE.Mesh(iceGeo, iceMat);
    iceMesh.position.set(enemy.x, enemy.y + yOffset, enemy.z);

    // Decorative ice crystals / frosted spikes on the statue
    const spikeGeo = new THREE.ConeGeometry(0.24, 0.85, 5);
    const spikeMat = new THREE.MeshBasicMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.9 });
    for (let s = 0; s < 4; s++) {
      const spike = new THREE.Mesh(spikeGeo, spikeMat);
      const angle = (s / 4) * Math.PI * 2;
      spike.position.set(Math.cos(angle) * 0.45, 0.5, Math.sin(angle) * 0.45);
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

    audioService.playIceShatter();

    // 20 exploding crystalline ice shards
    const shardGeo = new THREE.TetrahedronGeometry(0.35);
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
    const originY = enemy.y + (enemy.type === 'fire' ? 3.5 : 1.0);

    for (let k = 0; k < shardCount; k++) {
      const shard = new THREE.Mesh(shardGeo, shardMat);
      shard.position.set(
        enemy.x + (Math.random() - 0.5) * 0.8,
        originY + (Math.random() - 0.5) * 0.8,
        enemy.z + (Math.random() - 0.5) * 0.8
      );
      shard.scale.setScalar(0.6 + Math.random() * 0.7);
      this.shardsGroup.add(shard);

      const blastSpeed = 16 + Math.random() * 22 + comboStep * 8;
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

  /**
   * Fires a realistic tracer bullet from thug's rifle toward Superman
   */
  private fireThugBurst(enemy: EnemyEntity, mesh: THREE.Group, playerX: number, playerY: number, playerZ: number) {
    audioService.playGunfire();

    // Trigger rifle muzzle flash
    const rifle = mesh.getObjectByName('rifle');
    if (rifle) {
      const flash = rifle.getObjectByName('muzzleFlash') as THREE.Mesh;
      if (flash && flash.material) {
        (flash.material as THREE.MeshBasicMaterial).opacity = 1.0;
        this.thugMuzzleFlashTimers.set(enemy.id, 0.08);
      }
    }

    // Origin of bullet: rifle barrel tip (~1.25m height)
    const originX = enemy.x;
    const originY = enemy.y + 1.25;
    const originZ = enemy.z;

    // Vector toward Superman's chest
    const targetY = Math.max(0.8, playerY + 1.2);
    const dir = new THREE.Vector3(playerX - originX, targetY - originY, playerZ - originZ).normalize();

    // Golden bullet tracer geometry
    const tracerGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.85, 6);
    tracerGeo.rotateX(Math.PI / 2);
    const tracerMat = new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
    });
    const tracerMesh = new THREE.Mesh(tracerGeo, tracerMat);
    tracerMesh.position.set(originX, originY, originZ);
    tracerMesh.lookAt(playerX, targetY, playerZ);
    this.combatVfxGroup.add(tracerMesh);

    const bulletSpeed = 160.0; // Fast realistic bullet speed

    this.bulletTracers.push({
      mesh: tracerMesh,
      vx: dir.x * bulletSpeed,
      vy: dir.y * bulletSpeed,
      vz: dir.z * bulletSpeed,
      life: 0.65,
      maxLife: 0.65,
    });
  }

  /**
   * Spawns iconic golden/blue bullet deflection sparks bursting off Superman's chest
   */
  private spawnBulletDeflection(x: number, y: number, z: number) {
    const now = performance.now();
    if (now - this.lastRicochetSoundTime > 120) {
      this.lastRicochetSoundTime = now;
      audioService.playBulletRicochet();
    }

    const sparkGeo = new THREE.SphereGeometry(0.06, 4, 4);
    const sparkMat = new THREE.MeshBasicMaterial({
      color: Math.random() > 0.4 ? 0xfef08a : 0x38bdf8,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending,
    });

    for (let i = 0; i < 7; i++) {
      const sparkMesh = new THREE.Mesh(sparkGeo, sparkMat);
      sparkMesh.position.set(x, y, z);
      this.combatVfxGroup.add(sparkMesh);

      const speed = 14 + Math.random() * 20;
      const angle = Math.random() * Math.PI * 2;
      const vElev = (Math.random() - 0.2) * 12;

      this.deflectionSparks.push({
        mesh: sparkMesh,
        vx: Math.cos(angle) * speed,
        vy: vElev + 4,
        vz: Math.sin(angle) * speed,
        life: 0.25,
        maxLife: 0.25,
      });
    }
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

    // Animate enemies & update combat AI
    this.enemies.forEach((enemy) => {
      if (!enemy.active) return;
      const mesh = this.enemyMeshes.get(enemy.id);
      if (!mesh) return;

      const dist = Math.hypot(enemy.x - playerX, enemy.y - playerY, enemy.z - playerZ);

      // --- 1. DYNAMIC ENEMY COMBAT BEHAVIORS ---
      if (!enemy.frozen) {
        if (enemy.type === 'thug') {
          // Thug Combat AI: Face Superman & Shoot when in range!
          if (dist < 65) {
            // Turn smoothly to aim at Superman
            const targetAngle = Math.atan2(playerX - enemy.x, playerZ - enemy.z);
            mesh.rotation.y = THREE.MathUtils.lerp(mesh.rotation.y, targetAngle, delta * 8);

            // Shoot rifle bursts
            let shootTimer = (this.thugShootTimers.get(enemy.id) || (0.8 + Math.random() * 1.5)) - delta;
            if (shootTimer <= 0) {
              shootTimer = 1.2 + Math.random() * 1.2;
              this.fireThugBurst(enemy, mesh, playerX, playerY, playerZ);
            }
            this.thugShootTimers.set(enemy.id, shootTimer);
          } else {
            // Idle scanning guard patrol
            mesh.rotation.y += Math.sin(Date.now() * 0.002 + parseInt(enemy.id.split('_')[1] || '0')) * 0.008;
          }

          // Muzzle flash timer fadeout
          const flashTime = this.thugMuzzleFlashTimers.get(enemy.id) || 0;
          if (flashTime > 0) {
            const nextFlash = flashTime - delta;
            this.thugMuzzleFlashTimers.set(enemy.id, nextFlash);
            if (nextFlash <= 0) {
              const rifle = mesh.getObjectByName('rifle');
              if (rifle) {
                const flash = rifle.getObjectByName('muzzleFlash') as THREE.Mesh;
                if (flash && flash.material) {
                  (flash.material as THREE.MeshBasicMaterial).opacity = 0.0;
                }
              }
            }
          }
        } else if (enemy.type === 'drone') {
          const time = Date.now() * 0.001;
          enemy.x = mission.x + Math.cos(time + parseInt(enemy.id.split('_')[1] || '0') * 2) * 35;
          enemy.z = mission.z + Math.sin(time + parseInt(enemy.id.split('_')[1] || '0') * 2) * 35;
          mesh.position.set(enemy.x, enemy.y, enemy.z);

          // Spin rotor discs
          mesh.traverse((child) => {
            if (child.name === 'rotor') {
              child.rotation.y += delta * 24;
            }
          });

          // Aim and pulse plasma when player is near
          if (dist < 75) {
            mesh.lookAt(playerX, playerY, playerZ);
            let dTimer = (this.droneShootTimers.get(enemy.id) || 1.5) - delta;
            if (dTimer <= 0) {
              dTimer = 2.2 + Math.random();
              audioService.playDroneLaser();
            }
            this.droneShootTimers.set(enemy.id, dTimer);
          }
        } else if (enemy.type === 'getaway-car') {
          enemy.z -= (enemy.speed || 30) * delta;
          if (enemy.z < -300) enemy.z = 300;
          mesh.position.set(enemy.x, enemy.y, enemy.z);
        } else if (enemy.type === 'fire') {
          // Volumetric flame pulsing
          mesh.scale.y = 1.0 + Math.sin(Date.now() * 0.012 + enemy.x) * 0.3;
          mesh.scale.x = 1.0 + Math.cos(Date.now() * 0.01 + enemy.z) * 0.15;
        }
      }

      // --- 2. SUPERMAN POWER IMPACTS ---
      // Heat Vision Hit
      if (isFiringHeat && dist < 90) {
        enemy.health -= delta * 150;
        // Thermal glow feedback
        mesh.traverse((child) => {
          if ((child as THREE.Mesh).isMesh && (child as THREE.Mesh).material) {
            const m = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
            if (m.color) m.color.setHex(0xffffff);
          }
        });
        if (enemy.frozen) {
          const iceMesh = this.frozenIceMeshes.get(enemy.id);
          if (iceMesh) {
            this.missionGroup.remove(iceMesh);
            this.frozenIceMeshes.delete(enemy.id);
          }
          enemy.frozen = false;
        }
      }

      // Freeze Breath Hit
      if (isFiringFreeze && dist < 32) {
        enemy.health -= delta * 90;
        enemy.freezeProgress = (enemy.freezeProgress || 0) + delta * 160;

        if (enemy.freezeProgress >= 70 && !enemy.frozen) {
          this.freezeEnemy(enemy, mesh);
        }
      }

      // Check defeat
      if (enemy.health <= 0 && enemy.active) {
        enemy.active = false;
        mission.progress += 1;
        progressGained += 1;

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

    // --- 3. BULLET TRACERS & RICOCHET DEFLECTION PHYSICS ---
    const playerChestPos = new THREE.Vector3(playerX, playerY + 1.2, playerZ);

    for (let b = this.bulletTracers.length - 1; b >= 0; b--) {
      const bullet = this.bulletTracers[b];
      bullet.life -= delta;

      bullet.mesh.position.x += bullet.vx * delta;
      bullet.mesh.position.y += bullet.vy * delta;
      bullet.mesh.position.z += bullet.vz * delta;

      // Check deflection proximity to Superman's chest
      const dToPlayer = bullet.mesh.position.distanceTo(playerChestPos);
      if (dToPlayer < 1.6) {
        // PING! Bullets ricochet off Superman's indestructible chest!
        this.spawnBulletDeflection(playerX, playerY + 1.2, playerZ);
        this.combatVfxGroup.remove(bullet.mesh);
        this.bulletTracers.splice(b, 1);
        continue;
      }

      // Expired bullets
      if (bullet.life <= 0 || bullet.mesh.position.y <= 0) {
        this.combatVfxGroup.remove(bullet.mesh);
        this.bulletTracers.splice(b, 1);
      }
    }

    // --- 4. RICOCHET SPARK PARTICLES UPDATE ---
    for (let s = this.deflectionSparks.length - 1; s >= 0; s--) {
      const spark = this.deflectionSparks[s];
      spark.life -= delta;

      if (spark.life <= 0) {
        this.combatVfxGroup.remove(spark.mesh);
        this.deflectionSparks.splice(s, 1);
        continue;
      }

      spark.vy -= 28 * delta; // Gravity
      spark.mesh.position.x += spark.vx * delta;
      spark.mesh.position.y += spark.vy * delta;
      spark.mesh.position.z += spark.vz * delta;

      const scale = spark.life / spark.maxLife;
      spark.mesh.scale.setScalar(scale);
    }

    // Update urban props physics
    for (let i = 0; i < this.urbanProps.length; i++) {
      const prop = this.urbanProps[i];
      if (Math.abs(prop.vx) > 0.05 || Math.abs(prop.vy) > 0.05 || Math.abs(prop.vz) > 0.05) {
        prop.vy -= 36 * delta;
        prop.x += prop.vx * delta;
        prop.y += prop.vy * delta;
        prop.z += prop.vz * delta;

        prop.mesh.rotation.x += prop.rotVx * delta;
        prop.mesh.rotation.z += prop.rotVz * delta;

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

    // Update ice crystal fragments physics
    for (let s = this.iceShards.length - 1; s >= 0; s--) {
      const shard = this.iceShards[s];
      shard.life -= delta;
      if (shard.life <= 0) {
        this.shardsGroup.remove(shard.mesh);
        this.iceShards.splice(s, 1);
        continue;
      }

      shard.vy -= 32 * delta;
      shard.mesh.position.x += shard.vx * delta;
      shard.mesh.position.y += shard.vy * delta;
      shard.mesh.position.z += shard.vz * delta;

      shard.mesh.rotation.x += shard.rotVx * delta;
      shard.mesh.rotation.z += shard.rotVz * delta;

      if (shard.mesh.position.y <= 0.3) {
        shard.mesh.position.y = 0.3;
        shard.vy = -shard.vy * 0.4;
        shard.vx *= 0.7;
        shard.vz *= 0.7;
      }

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

    const dirX = Math.sin(rotY);
    const dirZ = Math.cos(rotY);

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
            mesh.traverse((child) => {
              if ((child as THREE.Mesh).isMesh && (child as THREE.Mesh).material) {
                const m = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
                if (m.color) m.color.setHex(0xffffff);
              }
            });
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

    // Punch urban props
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
          enemy.health -= 120;
          // Blast thugs away from slam center
          const dx = enemy.x - playerX;
          const dz = enemy.z - playerZ;
          const len = Math.hypot(dx, dz) || 1;
          enemy.x += (dx / len) * 12;
          enemy.z += (dz / len) * 12;
          if (mesh) mesh.position.set(enemy.x, enemy.y, enemy.z);
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

  public getActiveMission(): Mission {
    return this.missions[this.activeMissionIndex];
  }

  public switchMission(index: number) {
    if (index >= 0 && index < this.missions.length) {
      this.missions.forEach((m, idx) => {
        m.active = idx === index;
      });
      this.activeMissionIndex = index;
      this.spawnMissionEntities(this.missions[index]);
    }
  }

  public dispose() {
    this.scene.remove(this.missionGroup);
    this.scene.remove(this.propsGroup);
    this.scene.remove(this.shardsGroup);
    this.scene.remove(this.combatVfxGroup);
    if (this.beaconMesh) this.scene.remove(this.beaconMesh);
  }
}
