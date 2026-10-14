import * as THREE from 'three';
import { audioService } from '../services/AudioService';

export interface Pedestrian {
  id: number;
  group: THREE.Group;
  head: THREE.Mesh;
  hat?: THREE.Mesh;
  torso: THREE.Mesh;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  x: number;
  z: number;
  dirX: number;
  dirZ: number;
  speed: number;
  walkCycle: number;
  isCheering: boolean;
  cheerTimer: number;
  isCowering: boolean;
  cowerTimer: number;
  dialogue?: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  archetype: 'business' | 'reporter' | 'casual' | 'police';
}

export class NPCSystem {
  private scene: THREE.Scene;
  private npcs: Pedestrian[] = [];
  private npcGroup: THREE.Group;
  private lastCheerAudioTime: number = 0;
  private latestCitizenDialogue: string | null = null;
  private dialogueExpiryTime: number = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.npcGroup = new THREE.Group();
    this.scene.add(this.npcGroup);

    this.spawnPedestrians();
  }

  private spawnPedestrians() {
    // -------------------------------------------------------------------------
    // ACCURATE 1:1 HUMAN SCALE (Total height ~ 1.76m, grounded at y = 0.0)
    // -------------------------------------------------------------------------
    // Shoes: height 0.08, width 0.12, depth 0.22
    const shoeGeo = new THREE.BoxGeometry(0.12, 0.08, 0.22);
    // Legs: height 0.74, radius 0.075
    const legGeo = new THREE.CylinderGeometry(0.075, 0.065, 0.74, 8);
    // Torso: height 0.54, width 0.38, depth 0.22
    const torsoGeo = new THREE.BoxGeometry(0.38, 0.54, 0.22);
    // Head: radius 0.125
    const headGeo = new THREE.SphereGeometry(0.125, 10, 10);
    // Hair cap: slightly larger sphere with cutout
    const hairGeo = new THREE.SphereGeometry(0.132, 10, 8);
    // Fedora Hat for local reporters and street journalists
    const hatBrimGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.03, 12);
    const hatCrownGeo = new THREE.CylinderGeometry(0.14, 0.15, 0.12, 12);
    // Police Cap
    const capVisorGeo = new THREE.BoxGeometry(0.2, 0.02, 0.14);
    const capCrownGeo = new THREE.CylinderGeometry(0.15, 0.14, 0.08, 12);
    // Arms: height 0.58, radius 0.055
    const armGeo = new THREE.CylinderGeometry(0.055, 0.048, 0.58, 8);
    // Hands: small sphere
    const handGeo = new THREE.SphereGeometry(0.045, 6, 6);

    // Realistic PBR skin tones
    const skinMats = [
      new THREE.MeshStandardMaterial({ color: 0xf5c6ad, roughness: 0.65 }),
      new THREE.MeshStandardMaterial({ color: 0xe0a98b, roughness: 0.65 }),
      new THREE.MeshStandardMaterial({ color: 0xb57853, roughness: 0.68 }),
      new THREE.MeshStandardMaterial({ color: 0x6e4530, roughness: 0.7 }),
    ];

    // Attire materials
    const shoeMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });
    const hairMats = [
      new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.5 }), // Black
      new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.5 }), // Brown
      new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.5 }), // Blonde
      new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.5 }), // Gray
    ];

    // Business suits for the historic center and office districts
    const suitMats = [
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 }), // Navy
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.6 }), // Midnight
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.65 }), // Charcoal
      new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.65 }), // Slate
    ];

    // Reporter trench coats
    const trenchMats = [
      new THREE.MeshStandardMaterial({ color: 0xd4b996, roughness: 0.7 }), // Khaki
      new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.7 }), // Warm stone
      new THREE.MeshStandardMaterial({ color: 0xa8a29e, roughness: 0.7 }), // Light trench
    ];

    // Casual attire in Bogotá's cool high-altitude weather
    const casualMats = [
      new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.7 }), // Blue jacket
      new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.7 }), // Crimson hoodie
      new THREE.MeshStandardMaterial({ color: 0x059669, roughness: 0.7 }), // Emerald jacket
      new THREE.MeshStandardMaterial({ color: 0x7c3aed, roughness: 0.7 }), // Purple sweater
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.6 }), // White windbreaker
    ];

    // Bogotá Metropolitan Police
    const policeMat = new THREE.MeshStandardMaterial({ color: 0x172554, roughness: 0.5 });
    const policeBadgeMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.8, roughness: 0.2 });

    // Pedestrian pockets around the playable Bogotá landmarks.
    const zones = [
      { minX: -130, maxX: 130, minZ: -130, maxZ: 130, count: 42, label: 'La Candelaria' },
      { minX: 100, maxX: 260, minZ: -210, maxZ: -30, count: 24, label: 'Centro Internacional' },
      { minX: -270, maxX: -80, minZ: -210, maxZ: 60, count: 24, label: 'Centro Histórico' },
      { minX: -340, maxX: -150, minZ: -520, maxZ: -330, count: 34, label: 'Parque Simón Bolívar' },
      { minX: 190, maxX: 340, minZ: -460, maxZ: -320, count: 24, label: 'El Campín' },
      { minX: 90, maxX: 180, minZ: 90, maxZ: 260, count: 18, label: 'Carrera Décima' },
    ];

    let idCounter = 0;

    zones.forEach((zone) => {
      for (let i = 0; i < zone.count; i++) {
        const pGroup = new THREE.Group();

        // Assign Archetype
        const randArchetype = Math.random();
        let archetype: Pedestrian['archetype'] = 'casual';
        let outfitMat = casualMats[Math.floor(Math.random() * casualMats.length)];
        let pantsMat = casualMats[Math.floor(Math.random() * casualMats.length)];

        if (zone.label === 'Centro Histórico' || zone.label === 'Centro Internacional' || randArchetype < 0.28) {
          archetype = 'business';
          outfitMat = suitMats[Math.floor(Math.random() * suitMats.length)];
          pantsMat = outfitMat;
        } else if (zone.label === 'La Candelaria' && randArchetype < 0.48) {
          archetype = 'reporter';
          outfitMat = trenchMats[Math.floor(Math.random() * trenchMats.length)];
          pantsMat = suitMats[Math.floor(Math.random() * suitMats.length)];
        } else if (randArchetype > 0.86) {
          archetype = 'police';
          outfitMat = policeMat;
          pantsMat = policeMat;
        }

        const skinMat = skinMats[Math.floor(Math.random() * skinMats.length)];
        const hairMat = hairMats[Math.floor(Math.random() * hairMats.length)];

        // --- 1. LEGS & SHOES (Grounded with feet touching y = 0.0) ---
        // Left Leg Group (pivot at hip y = 0.82)
        const leftLegGroup = new THREE.Group();
        leftLegGroup.position.set(-0.11, 0.82, 0);

        const leftLegMesh = new THREE.Mesh(legGeo, pantsMat);
        leftLegMesh.position.y = -0.37;
        leftLegMesh.castShadow = true;
        leftLegGroup.add(leftLegMesh);

        const leftShoe = new THREE.Mesh(shoeGeo, shoeMat);
        leftShoe.position.set(0, -0.78, 0.03);
        leftShoe.castShadow = true;
        leftLegGroup.add(leftShoe);

        pGroup.add(leftLegGroup);

        // Right Leg Group (pivot at hip y = 0.82)
        const rightLegGroup = new THREE.Group();
        rightLegGroup.position.set(0.11, 0.82, 0);

        const rightLegMesh = new THREE.Mesh(legGeo, pantsMat);
        rightLegMesh.position.y = -0.37;
        rightLegMesh.castShadow = true;
        rightLegGroup.add(rightLegMesh);

        const rightShoe = new THREE.Mesh(shoeGeo, shoeMat);
        rightShoe.position.set(0, -0.78, 0.03);
        rightShoe.castShadow = true;
        rightLegGroup.add(rightShoe);

        pGroup.add(rightLegGroup);

        // --- 2. TORSO & PELVIS (y = 0.82 to 1.36) ---
        const torso = new THREE.Mesh(torsoGeo, outfitMat);
        torso.position.y = 1.09;
        torso.castShadow = true;
        torso.receiveShadow = true;
        pGroup.add(torso);

        // Police Badge or Reporter Press Badge
        if (archetype === 'police') {
          const badgeGeo = new THREE.BoxGeometry(0.06, 0.07, 0.02);
          const badge = new THREE.Mesh(badgeGeo, policeBadgeMat);
          badge.position.set(0.1, 1.22, 0.12);
          pGroup.add(badge);
        }

        // --- 3. HEAD & NECK (Neck at 1.36, head center at 1.54, top at 1.76m) ---
        const neckGeo = new THREE.CylinderGeometry(0.06, 0.065, 0.12, 8);
        const neck = new THREE.Mesh(neckGeo, skinMat);
        neck.position.y = 1.38;
        pGroup.add(neck);

        const head = new THREE.Mesh(headGeo, skinMat);
        head.position.y = 1.54;
        head.castShadow = true;
        pGroup.add(head);

        // Hair Mesh
        const hair = new THREE.Mesh(hairGeo, hairMat);
        hair.position.set(0, 1.57, -0.01);
        hair.scale.set(1.0, 0.95, 1.05);
        pGroup.add(hair);

        // Hats (Fedora for reporters, Cap for police)
        let hat: THREE.Mesh | undefined;
        if (archetype === 'reporter') {
          const fedoraGroup = new THREE.Group();
          const brim = new THREE.Mesh(hatBrimGeo, outfitMat);
          brim.position.y = 1.66;
          fedoraGroup.add(brim);
          const crown = new THREE.Mesh(hatCrownGeo, outfitMat);
          crown.position.y = 1.72;
          fedoraGroup.add(crown);
          pGroup.add(fedoraGroup);
        } else if (archetype === 'police') {
          const policeCapGroup = new THREE.Group();
          const capCrown = new THREE.Mesh(capCrownGeo, policeMat);
          capCrown.position.y = 1.67;
          policeCapGroup.add(capCrown);
          const visor = new THREE.Mesh(capVisorGeo, shoeMat);
          visor.position.set(0, 1.64, 0.12);
          visor.rotation.x = 0.1;
          policeCapGroup.add(visor);
          pGroup.add(policeCapGroup);
        }

        // --- 4. ARMS & HANDS (Shoulder pivot at y = 1.30) ---
        // Left Arm Group
        const leftArmGroup = new THREE.Group();
        leftArmGroup.position.set(-0.25, 1.30, 0);

        const leftArmMesh = new THREE.Mesh(armGeo, outfitMat);
        leftArmMesh.position.y = -0.29;
        leftArmMesh.castShadow = true;
        leftArmGroup.add(leftArmMesh);

        const leftHand = new THREE.Mesh(handGeo, skinMat);
        leftHand.position.y = -0.60;
        leftArmGroup.add(leftHand);

        pGroup.add(leftArmGroup);

        // Right Arm Group
        const rightArmGroup = new THREE.Group();
        rightArmGroup.position.set(0.25, 1.30, 0);

        const rightArmMesh = new THREE.Mesh(armGeo, outfitMat);
        rightArmMesh.position.y = -0.29;
        rightArmMesh.castShadow = true;
        rightArmGroup.add(rightArmMesh);

        const rightHand = new THREE.Mesh(handGeo, skinMat);
        rightHand.position.y = -0.60;
        rightArmGroup.add(rightHand);

        pGroup.add(rightArmGroup);

        // Spawn position along sidewalk grid (STRICTLY GROUNDED at y = 0.0)
        const spawnX = zone.minX + Math.random() * (zone.maxX - zone.minX);
        const spawnZ = zone.minZ + Math.random() * (zone.maxZ - zone.minZ);
        pGroup.position.set(spawnX, 0.0, spawnZ);

        // Walking direction
        const axis = Math.random() > 0.5;
        const dir = Math.random() > 0.5 ? 1 : -1;
        const dirX = axis ? dir : 0;
        const dirZ = axis ? 0 : dir;

        pGroup.rotation.y = Math.atan2(dirX, dirZ);

        // Pedestrians are detailed but small; avoid drawing every limb into the city shadow map.
        pGroup.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = false;
            child.receiveShadow = false;
          }
        });
        this.npcGroup.add(pGroup);

        this.npcs.push({
          id: idCounter++,
          group: pGroup,
          head,
          hat,
          torso,
          leftLeg: leftLegGroup,
          rightLeg: rightLegGroup,
          leftArm: leftArmGroup,
          rightArm: rightArmGroup,
          x: spawnX,
          z: spawnZ,
          dirX,
          dirZ,
          speed: 1.2 + Math.random() * 1.5,
          walkCycle: Math.random() * Math.PI * 2,
          isCheering: false,
          cheerTimer: 0,
          isCowering: false,
          cowerTimer: 0,
          minX: zone.minX,
          maxX: zone.maxX,
          minZ: zone.minZ,
          maxZ: zone.maxZ,
          archetype,
        });
      }
    });
  }

  public update(
    playerX: number,
    playerY: number,
    playerZ: number,
    delta: number,
    isSupersonic: boolean = false,
    isHeroLanding: boolean = false
  ) {
    const isPlayerNearGround = playerY < 28;
    const now = performance.now();

    const citizenCheers = [
      '¡Es Superman! ¡El Hombre de Acero!',
      '¡Miren arriba, en el cielo!',
      '¡Bogotá está a salvo contigo!',
      '¡Gracias por cuidar a la gente, Superman!',
      '¡Que se entere toda la ciudad: nos salvaste!',
      '¡La Caracas está libre, sigamos evacuando!',
      '¡El teleférico de Monserrate está a salvo!',
    ];

    for (let i = 0; i < this.npcs.length; i++) {
      const npc = this.npcs[i];

      // Distance to Superman
      const dx = npc.x - playerX;
      const dz = npc.z - playerZ;
      const distSq = dx * dx + dz * dz;

      // Distance culling: hide meshes beyond 200m to preserve 60 FPS
      if (distSq > 40000) {
        if (npc.group.visible) npc.group.visible = false;
        continue;
      }

      if (!npc.group.visible) npc.group.visible = true;
      const dist = Math.sqrt(distSq);

      // --- 1. REACTION TO HERO LANDING / SHOCKWAVE ---
      if (isHeroLanding && dist < 24) {
        npc.isCowering = true;
        npc.cowerTimer = 2.2;
        npc.isCheering = false;
      }

      // --- 2. REACTION TO SUPERSONIC BOOM OVERHEAD ---
      if (isSupersonic && isPlayerNearGround && dist < 35) {
        npc.isCowering = true;
        npc.cowerTimer = 1.6;
        npc.isCheering = false;
      }

      // --- 3. REACTION TO SUPERMAN WALKING OR HOVERING CLOSE ---
      if (isPlayerNearGround && dist < 14 && !npc.isCowering) {
        npc.isCheering = true;
        npc.cheerTimer = 2.5;

        // Trigger citizen cheer audio occasionally
        if (now - this.lastCheerAudioTime > 5500) {
          this.lastCheerAudioTime = now;
          audioService.playCheer();
          this.latestCitizenDialogue = citizenCheers[Math.floor(Math.random() * citizenCheers.length)];
          this.dialogueExpiryTime = now + 4000;

          // Asynchronously query Gemini dialogue API for live responsive dialogue
          fetch('/api/dialogue', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              heroAction: isSupersonic ? 'Vuelo supersónico rasante' : 'Aterrizaje heroico entre ciudadanos',
              zone: npc.archetype === 'business' ? 'Centro Histórico' : npc.archetype === 'reporter' ? 'La Candelaria' : 'Bogotá Urbana',
            }),
          })
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
              if (data?.dialogue) {
                this.latestCitizenDialogue = data.dialogue;
                this.dialogueExpiryTime = performance.now() + 4500;
              }
            })
            .catch(() => {
              // Graceful silent fallback to the preselected citizen cheer
            });
        }
      }

      // Update reaction timers
      if (npc.cowerTimer > 0) {
        npc.cowerTimer -= delta;
        if (npc.cowerTimer <= 0) npc.isCowering = false;
      }

      if (npc.cheerTimer > 0) {
        npc.cheerTimer -= delta;
        if (npc.cheerTimer <= 0) npc.isCheering = false;
      }

      // --- ANIMATION BLENDING ---
      if (npc.isCowering) {
        // Cowering / Ducking pose (cover head with arms, bend knees)
        const angleToSuperman = Math.atan2(-dx, -dz);
        npc.group.rotation.y = THREE.MathUtils.lerp(npc.group.rotation.y, angleToSuperman, delta * 6);

        // Crouch torso down slightly
        npc.torso.position.y = 0.95;
        npc.head.position.y = 1.38;

        // Arms shielding head
        npc.leftArm.rotation.x = Math.PI - 0.6;
        npc.leftArm.rotation.z = 0.5;
        npc.rightArm.rotation.x = Math.PI - 0.6;
        npc.rightArm.rotation.z = -0.5;

        npc.leftLeg.rotation.x = 0.35;
        npc.rightLeg.rotation.x = 0.35;
      } else if (npc.isCheering) {
        // Cheering pose: face Superman, jump slightly, wave arms in excitement!
        const angleToSuperman = Math.atan2(-dx, -dz);
        npc.group.rotation.y = THREE.MathUtils.lerp(npc.group.rotation.y, angleToSuperman, delta * 8);

        // Reset torso height
        npc.torso.position.y = 1.09 + Math.abs(Math.sin(now * 0.008 + npc.id)) * 0.08;
        npc.head.position.y = 1.54 + Math.abs(Math.sin(now * 0.008 + npc.id)) * 0.08;

        // Animated clapping / double arm cheer wave
        const cheerWave = Math.sin(now * 0.014 + npc.id * 1.5) * 0.5;
        npc.leftArm.rotation.x = Math.PI - 0.4 + cheerWave;
        npc.leftArm.rotation.z = -0.25;
        npc.rightArm.rotation.x = Math.PI - 0.4 - cheerWave;
        npc.rightArm.rotation.z = 0.25;

        npc.leftLeg.rotation.x = 0;
        npc.rightLeg.rotation.x = 0;
      } else {
        // Normal grounded walking locomotion
        npc.torso.position.y = 1.09;
        npc.head.position.y = 1.54;

        npc.x += npc.dirX * npc.speed * delta;
        npc.z += npc.dirZ * npc.speed * delta;

        // Bounce back within district sidewalk bounds
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
        // Strictly at ground level:
        npc.group.position.y = 0.0;

        // Natural walking stride animation (alternating legs & counter-balanced arms)
        npc.walkCycle += delta * (npc.speed * 4.6);
        const legSwing = Math.sin(npc.walkCycle) * 0.52;
        npc.leftLeg.rotation.x = legSwing;
        npc.rightLeg.rotation.x = -legSwing;

        npc.leftArm.rotation.x = -legSwing * 0.65;
        npc.leftArm.rotation.z = -0.06;
        npc.rightArm.rotation.x = legSwing * 0.65;
        npc.rightArm.rotation.z = 0.06;
      }
    }
  }

  public getActiveDialogue(): string | null {
    if (this.latestCitizenDialogue && performance.now() < this.dialogueExpiryTime) {
      return this.latestCitizenDialogue;
    }
    return null;
  }

  public dispose() {
    this.scene.remove(this.npcGroup);
  }
}
