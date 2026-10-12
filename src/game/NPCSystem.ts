import * as THREE from 'three';

interface Pedestrian {
  id: number;
  group: THREE.Group;
  head: THREE.Mesh;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  leftArm: THREE.Mesh;
  rightArm: THREE.Mesh;
  x: number;
  z: number;
  dirX: number;
  dirZ: number;
  speed: number;
  walkCycle: number;
  isCheering: boolean;
  cheerTimer: number;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export class NPCSystem {
  private scene: THREE.Scene;
  private npcs: Pedestrian[] = [];
  private npcGroup: THREE.Group;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.npcGroup = new THREE.Group();
    this.scene.add(this.npcGroup);

    this.spawnPedestrians();
  }

  private spawnPedestrians() {
    // Shared geometries for high performance and low draw calls
    const torsoGeo = new THREE.BoxGeometry(0.38, 0.65, 0.22);
    const headGeo = new THREE.SphereGeometry(0.16, 8, 8);
    const limbGeo = new THREE.CylinderGeometry(0.07, 0.06, 0.6, 6);

    // Color palettes for diverse urban attire
    const outfitColors = [
      0x1e293b, 0x334155, 0x475569, 0x2563eb, 0xd97706,
      0x059669, 0xdc2626, 0x7c3aed, 0xe2e8f0, 0x854d0e,
    ];

    const skinMat = new THREE.MeshStandardMaterial({
      color: 0xf5d0b0,
      roughness: 0.8,
    });

    const outfitMats = outfitColors.map(
      (c) =>
        new THREE.MeshStandardMaterial({
          color: c,
          roughness: 0.7,
        })
    );

    // Sidewalk zones around Metropolis Downtown, LexCorp, Daily Planet, Centennial Park, Bayside
    const zones = [
      { minX: -120, maxX: 120, minZ: -120, maxZ: 120, count: 32 },  // Downtown core
      { minX: 100, maxX: 260, minZ: -180, maxZ: -20, count: 20 },   // LexCorp tech corridor
      { minX: -260, maxX: -80, minZ: -200, maxZ: 50, count: 20 },   // Financial Bank avenue
      { minX: -150, maxX: 150, minZ: 60, maxZ: 260, count: 24 },    // Centennial Park promenade
      { minX: -450, maxX: -280, minZ: -120, maxZ: 120, count: 16 }, // Bayside Harbor docks
    ];

    let idCounter = 0;

    zones.forEach((zone) => {
      for (let i = 0; i < zone.count; i++) {
        const pGroup = new THREE.Group();
        const mat = outfitMats[Math.floor(Math.random() * outfitMats.length)];

        // Torso
        const torso = new THREE.Mesh(torsoGeo, mat);
        torso.position.y = 0.95;
        pGroup.add(torso);

        // Head
        const head = new THREE.Mesh(headGeo, skinMat);
        head.position.y = 1.45;
        pGroup.add(head);

        // Limbs
        const leftLeg = new THREE.Mesh(limbGeo, mat);
        leftLeg.position.set(-0.11, 0.35, 0);
        pGroup.add(leftLeg);

        const rightLeg = new THREE.Mesh(limbGeo, mat);
        rightLeg.position.set(0.11, 0.35, 0);
        pGroup.add(rightLeg);

        const leftArm = new THREE.Mesh(limbGeo, mat);
        leftArm.position.set(-0.25, 0.95, 0);
        pGroup.add(leftArm);

        const rightArm = new THREE.Mesh(limbGeo, mat);
        rightArm.position.set(0.25, 0.95, 0);
        pGroup.add(rightArm);

        // Spawn position along sidewalk grid
        const spawnX = zone.minX + Math.random() * (zone.maxX - zone.minX);
        const spawnZ = zone.minZ + Math.random() * (zone.maxZ - zone.minZ);
        pGroup.position.set(spawnX, 1.0, spawnZ);

        // Walking direction (either parallel to X or Z)
        const axis = Math.random() > 0.5;
        const dir = Math.random() > 0.5 ? 1 : -1;
        const dirX = axis ? dir : 0;
        const dirZ = axis ? 0 : dir;

        pGroup.rotation.y = Math.atan2(dirX, dirZ);

        this.npcGroup.add(pGroup);

        this.npcs.push({
          id: idCounter++,
          group: pGroup,
          head,
          leftLeg,
          rightLeg,
          leftArm,
          rightArm,
          x: spawnX,
          z: spawnZ,
          dirX,
          dirZ,
          speed: 1.4 + Math.random() * 1.6,
          walkCycle: Math.random() * Math.PI * 2,
          isCheering: false,
          cheerTimer: 0,
          minX: zone.minX,
          maxX: zone.maxX,
          minZ: zone.minZ,
          maxZ: zone.maxZ,
        });
      }
    });
  }

  public update(playerX: number, playerY: number, playerZ: number, delta: number) {
    const isPlayerNearby = playerY < 35;

    for (let i = 0; i < this.npcs.length; i++) {
      const npc = this.npcs[i];

      // Distance to player for LOD & Culling
      const dx = npc.x - playerX;
      const dz = npc.z - playerZ;
      const distSq = dx * dx + dz * dz;

      // Distance culling: hide meshes and skip updates beyond 180 meters
      if (distSq > 32400) {
        if (npc.group.visible) npc.group.visible = false;
        continue;
      }

      if (!npc.group.visible) npc.group.visible = true;

      // Interaction: Check if Superman is super close
      const dist = Math.sqrt(distSq);
      if (isPlayerNearby && dist < 16) {
        npc.isCheering = true;
        npc.cheerTimer = 1.8;
      }

      if (npc.cheerTimer > 0) {
        npc.cheerTimer -= delta;
        if (npc.cheerTimer <= 0) {
          npc.isCheering = false;
        }
      }

      if (npc.isCheering) {
        // Face Superman and wave arms excitedly!
        const angleToSuperman = Math.atan2(-dx, -dz);
        npc.group.rotation.y = THREE.MathUtils.lerp(npc.group.rotation.y, angleToSuperman, delta * 6);

        // Cheering arm wave
        const wave = Math.sin(Date.now() * 0.012 + npc.id) * 0.45;
        npc.leftArm.rotation.x = Math.PI - 0.3 + wave;
        npc.rightArm.rotation.x = Math.PI - 0.3 - wave;
        npc.leftLeg.rotation.x = 0;
        npc.rightLeg.rotation.x = 0;
      } else {
        // Normal walking locomotion
        npc.x += npc.dirX * npc.speed * delta;
        npc.z += npc.dirZ * npc.speed * delta;

        // Bounce back within zone bounds
        if (npc.x < npc.minX || npc.x > npc.maxX) {
          npc.dirX *= -1;
          npc.x = THREE.MathUtils.clamp(npc.x, npc.minX, npc.maxX);
          npc.group.rotation.y = Math.atan2(npc.dirX, npc.dirZ);
        }
        if (npc.z < npc.minZ || npc.z > npc.maxZ) {
          npc.dirZ *= -1;
          npc.z = THREE.MathUtils.clamp(npc.z, npc.minZ, npc.maxZ);
          npc.group.rotation.y = Math.atan2(npc.dirX, npc.dirZ);
        }

        npc.group.position.x = npc.x;
        npc.group.position.z = npc.z;

        // Walking cycle animation
        npc.walkCycle += delta * (npc.speed * 4.2);
        const legSwing = Math.sin(npc.walkCycle) * 0.45;
        npc.leftLeg.rotation.x = legSwing;
        npc.rightLeg.rotation.x = -legSwing;
        npc.leftArm.rotation.x = -legSwing * 0.7;
        npc.rightArm.rotation.x = legSwing * 0.7;
      }
    }
  }

  public dispose() {
    this.scene.remove(this.npcGroup);
  }
}
