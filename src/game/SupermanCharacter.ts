import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export interface SupermanMeshController {
  group: THREE.Group;
  characterGroup: THREE.Group;
  eyesMesh: THREE.Mesh;
  capeMesh: THREE.Mesh;
  sonicRingsGroup: THREE.Group;
  heatVisionGroup: THREE.Group;
  freezeParticles: THREE.Points;
  updatePose: (
    isFlying: boolean,
    isSupersonic: boolean,
    speed: number,
    delta: number,
    isFiringHeat: boolean,
    isFiringFreeze: boolean,
    isHeroLanding: boolean,
    landingProgress: number,
    isDiving?: boolean,
    isSolarCharging?: boolean,
    isWallRunning?: boolean,
    barrelRollAngle?: number,
    isHoldingObject?: boolean
  ) => void;
  triggerGroundSlamShockwave: () => void;
  triggerPunch: (comboStep?: number) => void;
  triggerInstantSonicBoom: () => void;
  loadExternalModel?: (url: string) => Promise<boolean>;
}

// ============================================================================
// PROCEDURAL PBR TEXTURE GENERATORS (AAA CINEMATIC MATERIALS)
// ============================================================================

/**
 * Generates a high-resolution 512x512 micro-hexagonal ballistic weave normal map.
 * Gives realistic microscopic textile relief to the superhero suit under directional lighting.
 */
function createSuitNormalMap(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  const imgData = ctx.createImageData(size, size);
  const data = imgData.data;

  const hexRadius = 8;
  const rowHeight = hexRadius * 1.5;
  const colWidth = hexRadius * Math.sqrt(3);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;

      // Hexagonal distance field approximation
      const u = (x % colWidth) / colWidth - 0.5;
      const v = (y % rowHeight) / rowHeight - 0.5;
      const dist = Math.sqrt(u * u + v * v);

      // Micro weave gradient
      const height = Math.cos(dist * Math.PI * 4) * 0.5 + 0.5;
      const nx = -Math.sin(dist * Math.PI * 4) * (u / (dist + 0.001)) * 0.35;
      const ny = -Math.sin(dist * Math.PI * 4) * (v / (dist + 0.001)) * 0.35;
      const nz = Math.sqrt(Math.max(0, 1.0 - nx * nx - ny * ny));

      // Tangent space normal encoding into RGB [0..255]
      data[idx] = Math.floor((nx * 0.5 + 0.5) * 255);
      data[idx + 1] = Math.floor((ny * 0.5 + 0.5) * 255);
      data[idx + 2] = Math.floor((nz * 0.5 + 0.5) * 255);
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(16, 16);
  return texture;
}

/**
 * Generates a high-resolution 256x256 skin micro-pore normal map for realistic facial epidermis.
 */
function createSkinNormalMap(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  const imgData = ctx.createImageData(size, size);
  const data = imgData.data;

  for (let i = 0; i < size * size; i++) {
    const idx = i * 4;
    const noiseX = (Math.random() - 0.5) * 0.12;
    const noiseY = (Math.random() - 0.5) * 0.12;
    const nz = Math.sqrt(Math.max(0, 1.0 - noiseX * noiseX - noiseY * noiseY));

    data[idx] = Math.floor((noiseX * 0.5 + 0.5) * 255);
    data[idx + 1] = Math.floor((noiseY * 0.5 + 0.5) * 255);
    data[idx + 2] = Math.floor((nz * 0.5 + 0.5) * 255);
    data[idx + 3] = 255;
  }

  ctx.putImageData(imgData, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(12, 12);
  return texture;
}

/**
 * Procedural Kryptonian Eye Iris Texture: Electric cobalt blue with radial fibers and limbal ring.
 */
function createIrisTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  const center = size / 2;
  const radius = size / 2 - 4;

  // Background Sclera blend
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);

  // Outer Limbal Ring (dark defining ring)
  const limbalGrad = ctx.createRadialGradient(center, center, radius * 0.82, center, center, radius);
  limbalGrad.addColorStop(0, '#1e3a8a');
  limbalGrad.addColorStop(0.85, '#0f172a');
  limbalGrad.addColorStop(1, '#020617');

  ctx.fillStyle = limbalGrad;
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.fill();

  // Radial Iris Fibers
  for (let angle = 0; angle < Math.PI * 2; angle += 0.035) {
    const fiberGrad = ctx.createRadialGradient(center, center, radius * 0.28, center, center, radius * 0.85);
    fiberGrad.addColorStop(0, '#38bdf8');
    fiberGrad.addColorStop(0.4, '#0284c7');
    fiberGrad.addColorStop(0.8, '#1e40af');
    fiberGrad.addColorStop(1, '#0f172a');

    ctx.strokeStyle = fiberGrad;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(center + Math.cos(angle) * (radius * 0.28), center + Math.sin(angle) * (radius * 0.28));
    ctx.lineTo(center + Math.cos(angle) * (radius * 0.88), center + Math.sin(angle) * (radius * 0.88));
    ctx.stroke();
  }

  // Dark central pupil
  ctx.fillStyle = '#050508';
  ctx.beginPath();
  ctx.arc(center, center, radius * 0.32, 0, Math.PI * 2);
  ctx.fill();

  // Specular catchlight reflection
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.beginPath();
  ctx.arc(center - radius * 0.18, center - radius * 0.18, radius * 0.09, 0, Math.PI * 2);
  ctx.fill();

  return new THREE.CanvasTexture(canvas);
}

/**
 * Procedural 3D Chest S-Shield Emblem with Gold Bevel and Crimson Kryptonian glyph.
 */
function createEmblemTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  // Transparent background
  ctx.clearRect(0, 0, size, size);

  // Gold Beveled Pentagonal Diamond Rim
  ctx.fillStyle = '#eab308';
  ctx.beginPath();
  ctx.moveTo(256, 32);
  ctx.lineTo(480, 140);
  ctx.lineTo(392, 470);
  ctx.lineTo(120, 470);
  ctx.lineTo(32, 140);
  ctx.closePath();
  ctx.fill();

  // Outer Rim Shadow / Bevel
  ctx.strokeStyle = '#a16207';
  ctx.lineWidth = 16;
  ctx.stroke();

  // Inner Crimson Enamel Background
  ctx.fillStyle = '#b91c1c';
  ctx.beginPath();
  ctx.moveTo(256, 68);
  ctx.lineTo(448, 160);
  ctx.lineTo(372, 442);
  ctx.lineTo(140, 442);
  ctx.lineTo(64, 160);
  ctx.closePath();
  ctx.fill();

  // Inner Metallic Gold Highlights
  ctx.strokeStyle = '#fef08a';
  ctx.lineWidth = 4;
  ctx.stroke();

  // Iconic Kryptonian 'S' Crest (stylized fluid heroic serpent/hope glyph)
  ctx.fillStyle = '#eab308';
  ctx.strokeStyle = '#78350f';
  ctx.lineWidth = 8;

  // Upper loop of S
  ctx.beginPath();
  ctx.ellipse(300, 185, 110, 68, -0.32, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Cutout inside upper loop
  ctx.fillStyle = '#b91c1c';
  ctx.beginPath();
  ctx.ellipse(312, 185, 62, 38, -0.32, 0, Math.PI * 2);
  ctx.fill();

  // Lower loop of S
  ctx.fillStyle = '#eab308';
  ctx.beginPath();
  ctx.ellipse(220, 325, 120, 78, -0.32, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Cutout inside lower loop
  ctx.fillStyle = '#b91c1c';
  ctx.beginPath();
  ctx.ellipse(208, 325, 72, 44, -0.32, 0, Math.PI * 2);
  ctx.fill();

  // Center diagonal cross-bar
  ctx.fillStyle = '#eab308';
  ctx.beginPath();
  ctx.moveTo(140, 240);
  ctx.lineTo(380, 255);
  ctx.lineTo(350, 290);
  ctx.lineTo(120, 275);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  return new THREE.CanvasTexture(canvas);
}

// ============================================================================
// MAIN AAA SUPERMAN CHARACTER BUILDER
// ============================================================================

export function createSupermanCharacter(scene: THREE.Scene): SupermanMeshController {
  const rootGroup = new THREE.Group();
  // 1:1 Realistic Human Scale (approx 1.95 meters height relative to Metropolis architecture)
  rootGroup.scale.set(0.44, 0.44, 0.44);
  scene.add(rootGroup);

  const characterGroup = new THREE.Group();
  rootGroup.add(characterGroup);

  // --- PROCEDURAL PBR TEXTURES ---
  const suitNormalMap = createSuitNormalMap();
  const skinNormalMap = createSkinNormalMap();
  const irisTexture = createIrisTexture();
  const emblemTexture = createEmblemTexture();

  // --- PBR MATERIALS ---
  const suitMat = new THREE.MeshPhysicalMaterial({
    color: 0x143c7d, // Deep Kryptonian Royal Navy
    roughness: 0.38,
    metalness: 0.12,
    clearcoat: 0.28,
    clearcoatRoughness: 0.2,
    normalMap: suitNormalMap,
  });

  const suitAccentMat = new THREE.MeshPhysicalMaterial({
    color: 0x0c254d, // Darker compression muscle panels
    roughness: 0.45,
    metalness: 0.15,
    clearcoat: 0.18,
    normalMap: suitNormalMap,
  });

  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xf5c6ad, // Athletic heroic skin tone
    roughness: 0.62,
    metalness: 0.04,
    normalMap: skinNormalMap,
  });

  const hairMat = new THREE.MeshStandardMaterial({
    color: 0x0a0a0c, // Raven black with subtle specular sheen
    roughness: 0.32,
    metalness: 0.12,
  });

  const redCapeMat = new THREE.MeshPhysicalMaterial({
    color: 0xc5161d, // Majestic Crimson Red
    roughness: 0.42,
    metalness: 0.08,
    clearcoat: 0.22,
    side: THREE.DoubleSide,
  });

  const redArmoredMat = new THREE.MeshStandardMaterial({
    color: 0xbe123c, // Combat boots and briefs
    roughness: 0.32,
    metalness: 0.28,
  });

  const goldMetallicMat = new THREE.MeshStandardMaterial({
    color: 0xeab308, // Solar Kryptonian Gold
    roughness: 0.18,
    metalness: 0.88,
  });

  const darkSoleMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b, // Tactical boot sole
    roughness: 0.82,
    metalness: 0.1,
  });

  // ==========================================================================
  // 1. ANATOMICAL TORSO & MUSCLE GROUPS (V-TAPER, PECS, ABS, LATS)
  // ==========================================================================
  const torsoGroup = new THREE.Group();
  characterGroup.add(torsoGroup);

  // Upper Thorax & Clavicular Core (Broad V-Taper)
  const upperThoraxGeo = new THREE.CylinderGeometry(1.08, 0.88, 1.45, 24);
  const upperThorax = new THREE.Mesh(upperThoraxGeo, suitMat);
  upperThorax.position.y = 3.65;
  upperThorax.castShadow = true;
  upperThorax.receiveShadow = true;
  torsoGroup.add(upperThorax);

  // Clavicles (Sculpted Collarbones)
  const clavicleGeo = new THREE.CylinderGeometry(0.1, 0.08, 1.25, 12);
  clavicleGeo.rotateZ(Math.PI / 2);
  const leftClavicle = new THREE.Mesh(clavicleGeo, suitMat);
  leftClavicle.position.set(-0.62, 4.25, 0.38);
  leftClavicle.rotation.y = 0.15;
  torsoGroup.add(leftClavicle);

  const rightClavicle = new THREE.Mesh(clavicleGeo, suitMat);
  rightClavicle.position.set(0.62, 4.25, 0.38);
  rightClavicle.rotation.y = -0.15;
  torsoGroup.add(rightClavicle);

  // Sculpted Pectoralis Major (Left & Right anatomical muscle slabs)
  const pecGeo = new THREE.BoxGeometry(0.64, 0.52, 0.32);
  const leftPec = new THREE.Mesh(pecGeo, suitMat);
  leftPec.position.set(-0.35, 3.86, 0.62);
  leftPec.rotation.y = 0.12;
  leftPec.rotation.z = -0.05;
  leftPec.castShadow = true;
  torsoGroup.add(leftPec);

  const rightPec = new THREE.Mesh(pecGeo, suitMat);
  rightPec.position.set(0.35, 3.86, 0.62);
  rightPec.rotation.y = -0.12;
  rightPec.rotation.z = 0.05;
  rightPec.castShadow = true;
  torsoGroup.add(rightPec);

  // 3D Dimensional Sculpted S-Shield Chest Crest
  const emblemShieldGeo = new THREE.BoxGeometry(0.96, 0.84, 0.12);
  const emblemMat = new THREE.MeshStandardMaterial({
    map: emblemTexture,
    roughness: 0.22,
    metalness: 0.65,
    transparent: true,
  });
  const chestEmblem = new THREE.Mesh(emblemShieldGeo, emblemMat);
  chestEmblem.position.set(0, 3.88, 0.74);
  chestEmblem.castShadow = true;
  torsoGroup.add(chestEmblem);

  // Gold Beveled Border Plate on Chest
  const rimBorderGeo = new THREE.BoxGeometry(1.02, 0.9, 0.06);
  const rimBorder = new THREE.Mesh(rimBorderGeo, goldMetallicMat);
  rimBorder.position.set(0, 3.88, 0.71);
  torsoGroup.add(rimBorder);

  // Latissimus Dorsi ("V-Taper Wings" under armpits)
  const latGeo = new THREE.BoxGeometry(0.38, 1.1, 0.42);
  const leftLat = new THREE.Mesh(latGeo, suitAccentMat);
  leftLat.position.set(-0.95, 3.45, -0.12);
  leftLat.rotation.z = 0.28;
  torsoGroup.add(leftLat);

  const rightLat = new THREE.Mesh(latGeo, suitAccentMat);
  rightLat.position.set(0.95, 3.45, -0.12);
  rightLat.rotation.z = -0.28;
  torsoGroup.add(rightLat);

  // Trapezius Muscle Slope (Neck to Shoulders)
  const trapGeo = new THREE.CylinderGeometry(0.55, 0.95, 0.68, 16);
  const trapMesh = new THREE.Mesh(trapGeo, suitMat);
  trapMesh.position.set(0, 4.35, -0.08);
  torsoGroup.add(trapMesh);

  // Sculpted 6-Pack Abdominals (Rectus Abdominis with Linea Alba)
  const abGeo = new THREE.BoxGeometry(0.32, 0.26, 0.18);
  for (let row = 0; row < 3; row++) {
    const yPos = 3.2 - row * 0.29;
    // Left ab pad
    const leftAb = new THREE.Mesh(abGeo, suitMat);
    leftAb.position.set(-0.19, yPos, 0.56 - row * 0.04);
    leftAb.rotation.y = 0.08;
    torsoGroup.add(leftAb);

    // Right ab pad
    const rightAb = new THREE.Mesh(abGeo, suitMat);
    rightAb.position.set(0.19, yPos, 0.56 - row * 0.04);
    rightAb.rotation.y = -0.08;
    torsoGroup.add(rightAb);
  }

  // Serratus Anterior & Obliques (Lateral Ribs)
  const ribGeo = new THREE.BoxGeometry(0.24, 0.16, 0.28);
  for (let r = 0; r < 3; r++) {
    const yPos = 3.32 - r * 0.26;
    const leftRib = new THREE.Mesh(ribGeo, suitAccentMat);
    leftRib.position.set(-0.68, yPos, 0.24);
    leftRib.rotation.z = 0.25;
    torsoGroup.add(leftRib);

    const rightRib = new THREE.Mesh(ribGeo, suitAccentMat);
    rightRib.position.set(0.68, yPos, 0.24);
    rightRib.rotation.z = -0.25;
    torsoGroup.add(rightRib);
  }

  // Lower Torso / Waist Section
  const lowerTorsoGeo = new THREE.CylinderGeometry(0.86, 0.76, 0.95, 20);
  const lowerTorso = new THREE.Mesh(lowerTorsoGeo, suitMat);
  lowerTorso.position.y = 2.52;
  torsoGroup.add(lowerTorso);

  // Segmented Gold Utility Belt with Kryptonian Solar Buckle
  const beltGeo = new THREE.CylinderGeometry(0.8, 0.8, 0.28, 24);
  const beltMesh = new THREE.Mesh(beltGeo, goldMetallicMat);
  beltMesh.position.y = 2.06;
  torsoGroup.add(beltMesh);

  // Buckle Emblem
  const buckleGeo = new THREE.BoxGeometry(0.32, 0.36, 0.18);
  const buckle = new THREE.Mesh(buckleGeo, redArmoredMat);
  buckle.position.set(0, 2.06, 0.82);
  torsoGroup.add(buckle);

  const buckleSigilGeo = new THREE.BoxGeometry(0.16, 0.22, 0.06);
  const buckleSigil = new THREE.Mesh(buckleSigilGeo, goldMetallicMat);
  buckleSigil.position.set(0, 2.06, 0.92);
  torsoGroup.add(buckleSigil);

  // Pelvis / Red Trunks Panel
  const pelvisGeo = new THREE.CylinderGeometry(0.78, 0.68, 0.72, 20);
  const pelvis = new THREE.Mesh(pelvisGeo, redArmoredMat);
  pelvis.position.y = 1.66;
  torsoGroup.add(pelvis);

  // ==========================================================================
  // 2. SCULPTED REALISTIC 3D HEAD, JAW, NOSE, LIPS, EYES & HAIR
  // ==========================================================================
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 4.45, 0);
  characterGroup.add(headGroup);

  // Muscular Neck with Sternocleidomastoid Bands
  const neckGeo = new THREE.CylinderGeometry(0.38, 0.44, 0.62, 16);
  const neck = new THREE.Mesh(neckGeo, skinMat);
  neck.position.y = 0.12;
  neck.castShadow = true;
  headGroup.add(neck);

  // Cranium (Smooth skull base)
  const skullGeo = new THREE.SphereGeometry(0.48, 24, 24);
  const skull = new THREE.Mesh(skullGeo, skinMat);
  skull.position.set(0, 0.58, 0.02);
  skull.scale.set(0.92, 1.05, 1.04);
  skull.castShadow = true;
  headGroup.add(skull);

  // Chiseled Square Jaw & Chin with Mental Cleft
  const jawGeo = new THREE.BoxGeometry(0.68, 0.42, 0.56);
  const jaw = new THREE.Mesh(jawGeo, skinMat);
  jaw.position.set(0, 0.38, 0.18);
  jaw.rotation.x = -0.15;
  headGroup.add(jaw);

  const chinGeo = new THREE.SphereGeometry(0.16, 12, 12);
  const chin = new THREE.Mesh(chinGeo, skinMat);
  chin.position.set(0, 0.24, 0.46);
  chin.scale.set(1.2, 0.9, 1.0);
  headGroup.add(chin);

  // Zygomatic Cheekbones
  const cheekGeo = new THREE.SphereGeometry(0.14, 12, 12);
  const leftCheek = new THREE.Mesh(cheekGeo, skinMat);
  leftCheek.position.set(-0.34, 0.54, 0.32);
  headGroup.add(leftCheek);

  const rightCheek = new THREE.Mesh(cheekGeo, skinMat);
  rightCheek.position.set(0.34, 0.54, 0.32);
  headGroup.add(rightCheek);

  // Sculpted 3D Nose (Bridge, Dorsum, Tip, Nostrils)
  const noseBridgeGeo = new THREE.CylinderGeometry(0.04, 0.07, 0.26, 8);
  noseBridgeGeo.rotateX(Math.PI / 10);
  const noseBridge = new THREE.Mesh(noseBridgeGeo, skinMat);
  noseBridge.position.set(0, 0.54, 0.52);
  headGroup.add(noseBridge);

  const noseTipGeo = new THREE.SphereGeometry(0.065, 10, 10);
  const noseTip = new THREE.Mesh(noseTipGeo, skinMat);
  noseTip.position.set(0, 0.42, 0.56);
  headGroup.add(noseTip);

  // Sculpted Lips & Philtrum Groove (Mouth Group for Freeze Breath Animation)
  const mouthGroup = new THREE.Group();
  mouthGroup.position.set(0, 0.32, 0.49);
  headGroup.add(mouthGroup);

  const lipMat = new THREE.MeshStandardMaterial({
    color: 0xd97768, // Natural lip vermilion
    roughness: 0.52,
    metalness: 0.05,
  });

  const upperLipGeo = new THREE.BoxGeometry(0.24, 0.055, 0.08);
  const upperLip = new THREE.Mesh(upperLipGeo, lipMat);
  upperLip.position.y = 0.025;
  mouthGroup.add(upperLip);

  const lowerLipGeo = new THREE.BoxGeometry(0.22, 0.065, 0.09);
  const lowerLip = new THREE.Mesh(lowerLipGeo, lipMat);
  lowerLip.position.y = -0.035;
  mouthGroup.add(lowerLip);

  // Sculpted Anatomical Ears (Left & Right)
  const earGeo = new THREE.TorusGeometry(0.11, 0.035, 8, 16, Math.PI * 1.4);
  const leftEar = new THREE.Mesh(earGeo, skinMat);
  leftEar.position.set(-0.46, 0.54, 0.02);
  leftEar.rotation.y = -Math.PI / 2 + 0.15;
  headGroup.add(leftEar);

  const rightEar = new THREE.Mesh(earGeo, skinMat);
  rightEar.position.set(0.46, 0.54, 0.02);
  rightEar.rotation.y = Math.PI / 2 - 0.15;
  headGroup.add(rightEar);

  // Heroic Masculine Eyebrows
  const browMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.6 });
  const browGeo = new THREE.BoxGeometry(0.18, 0.04, 0.06);

  const leftBrow = new THREE.Mesh(browGeo, browMat);
  leftBrow.position.set(-0.19, 0.68, 0.47);
  leftBrow.rotation.z = 0.08;
  leftBrow.rotation.y = 0.15;
  headGroup.add(leftBrow);

  const rightBrow = new THREE.Mesh(browGeo, browMat);
  rightBrow.position.set(0.19, 0.68, 0.47);
  rightBrow.rotation.z = -0.08;
  rightBrow.rotation.y = -0.15;
  headGroup.add(rightBrow);

  // Anatomical Eyeballs & Cornea (Left & Right with Iris Texture)
  const eyeRadius = 0.095;
  const eyeGeo = new THREE.SphereGeometry(eyeRadius, 16, 16);
  const eyeMat = new THREE.MeshStandardMaterial({
    map: irisTexture,
    roughness: 0.15,
    metalness: 0.1,
  });

  const eyeSpacing = 0.19;
  const eyeY = 0.59;
  const eyeZ = 0.45;

  const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
  leftEye.position.set(-eyeSpacing, eyeY, eyeZ);
  leftEye.rotation.y = -Math.PI / 2; // Orient iris outward forward (+Z)
  headGroup.add(leftEye);

  const rightEye = new THREE.Mesh(eyeGeo, eyeMat.clone());
  rightEye.position.set(eyeSpacing, eyeY, eyeZ);
  rightEye.rotation.y = -Math.PI / 2;
  headGroup.add(rightEye);

  // Heat Vision Emissive Proxy Mesh (for backwards compatibility)
  const eyesGeo = new THREE.BoxGeometry(0.44, 0.1, 0.08);
  const eyesMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
  const eyesMesh = new THREE.Mesh(eyesGeo, eyesMat);
  eyesMesh.position.set(0, eyeY, eyeZ + 0.02);
  eyesMesh.visible = false; // Hidden proxy mesh, irises handle the visual
  headGroup.add(eyesMesh);

  // Animated Eyelids (for realistic blinking simulation)
  const eyelidGeo = new THREE.SphereGeometry(eyeRadius + 0.015, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  const leftUpperLid = new THREE.Mesh(eyelidGeo, skinMat);
  leftUpperLid.position.set(-eyeSpacing, eyeY, eyeZ);
  leftUpperLid.rotation.x = -Math.PI / 2;
  headGroup.add(leftUpperLid);

  const rightUpperLid = new THREE.Mesh(eyelidGeo, skinMat);
  rightUpperLid.position.set(eyeSpacing, eyeY, eyeZ);
  rightUpperLid.rotation.x = -Math.PI / 2;
  headGroup.add(rightUpperLid);

  // Sculpted Volumetric Hair & Iconic Forehead S-Curl
  const hairGroup = new THREE.Group();
  headGroup.add(hairGroup);

  const hairCrownGeo = new THREE.SphereGeometry(0.52, 20, 20);
  const hairCrown = new THREE.Mesh(hairCrownGeo, hairMat);
  hairCrown.position.set(0, 0.72, -0.05);
  hairCrown.scale.set(1.02, 0.95, 1.12);
  hairCrown.castShadow = true;
  hairGroup.add(hairCrown);

  // Swept-Back Hair Strands
  const hairStrandGeo = new THREE.BoxGeometry(0.38, 0.16, 0.44);
  for (let s = 0; s < 4; s++) {
    const strand = new THREE.Mesh(hairStrandGeo, hairMat);
    strand.position.set((s - 1.5) * 0.22, 0.88, -0.08);
    strand.rotation.x = -0.32;
    strand.rotation.z = (s - 1.5) * 0.1;
    hairGroup.add(strand);
  }

  // Iconic Forehead Superman S-Curl
  const curlGeo = new THREE.TorusGeometry(0.14, 0.055, 10, 20, Math.PI * 1.25);
  const curlMesh = new THREE.Mesh(curlGeo, hairMat);
  curlMesh.position.set(-0.11, 0.84, 0.51);
  curlMesh.rotation.z = Math.PI / 3.2;
  curlMesh.rotation.y = 0.2;
  hairGroup.add(curlMesh);

  // ==========================================================================
  // 3. ARTICULATED ARMS, DELTOIDS, BICEPS & 5-FINGERED ANATOMICAL HANDS
  // ==========================================================================
  function createArm(isLeft: boolean) {
    const sign = isLeft ? -1 : 1;
    const armGroup = new THREE.Group();
    armGroup.position.set(sign * 1.35, 4.15, 0);

    // Sculpted 3-Headed Deltoid Shoulder Cap
    const deltoidGeo = new THREE.SphereGeometry(0.42, 16, 16);
    const deltoid = new THREE.Mesh(deltoidGeo, suitMat);
    deltoid.position.set(sign * 0.1, 0, 0);
    deltoid.scale.set(0.95, 1.25, 1.1);
    deltoid.castShadow = true;
    armGroup.add(deltoid);

    // Biceps & Triceps (Upper Arm)
    const upperArmGeo = new THREE.CylinderGeometry(0.31, 0.26, 1.15, 16);
    const upperArm = new THREE.Mesh(upperArmGeo, suitMat);
    upperArm.position.set(0, -0.62, 0);
    upperArm.castShadow = true;
    armGroup.add(upperArm);

    // Biceps Muscle Peak
    const bicepPeakGeo = new THREE.SphereGeometry(0.18, 12, 12);
    const bicepPeak = new THREE.Mesh(bicepPeakGeo, suitMat);
    bicepPeak.position.set(sign * 0.06, -0.58, 0.16);
    bicepPeak.scale.set(1.0, 1.4, 1.0);
    armGroup.add(bicepPeak);

    // Forearm Group (Elbow to Wrist)
    const forearmGroup = new THREE.Group();
    forearmGroup.position.set(0, -1.2, 0);
    armGroup.add(forearmGroup);

    // Forearm Musculature (Brachioradialis taper)
    const forearmGeo = new THREE.CylinderGeometry(0.26, 0.21, 1.12, 16);
    const forearmMesh = new THREE.Mesh(forearmGeo, suitMat);
    forearmMesh.position.set(0, -0.48, 0);
    forearmMesh.castShadow = true;
    forearmGroup.add(forearmMesh);

    // Kryptonian Gold Gauntlet Cuff at Wrist
    const gauntletCuffGeo = new THREE.CylinderGeometry(0.23, 0.22, 0.16, 16);
    const gauntletCuff = new THREE.Mesh(gauntletCuffGeo, goldMetallicMat);
    gauntletCuff.position.set(0, -0.98, 0);
    forearmGroup.add(gauntletCuff);

    // Anatomical 5-Fingered Hand Group
    const handGroup = new THREE.Group();
    handGroup.position.set(0, -1.15, 0);
    forearmGroup.add(handGroup);

    // Palm & Thenar Eminence (Thumb Ball)
    const palmGeo = new THREE.BoxGeometry(0.32, 0.34, 0.15);
    const palm = new THREE.Mesh(palmGeo, skinMat);
    palm.position.set(0, -0.15, 0);
    palm.castShadow = true;
    handGroup.add(palm);

    const thenarGeo = new THREE.SphereGeometry(0.12, 8, 8);
    const thenar = new THREE.Mesh(thenarGeo, skinMat);
    thenar.position.set(sign * 0.14, -0.1, 0.05);
    handGroup.add(thenar);

    // Thumb (Articulated Metacarpal + Phalanges)
    const thumbGroup = new THREE.Group();
    thumbGroup.position.set(sign * 0.16, -0.08, 0.06);
    thumbGroup.rotation.y = sign * 0.55;
    thumbGroup.rotation.z = sign * -0.45;
    handGroup.add(thumbGroup);

    const thumbPhalanxGeo = new THREE.CylinderGeometry(0.055, 0.048, 0.22, 8);
    const thumbPhalanx = new THREE.Mesh(thumbPhalanxGeo, skinMat);
    thumbPhalanx.position.y = -0.11;
    thumbGroup.add(thumbPhalanx);

    // 4 Fingers (Index, Middle, Ring, Pinky with joints)
    const fingers: THREE.Group[] = [];
    const fingerLengths = [0.28, 0.32, 0.29, 0.22]; // Index, Middle, Ring, Pinky
    const fingerXs = [sign * 0.1, sign * 0.03, sign * -0.04, sign * -0.11];

    for (let f = 0; f < 4; f++) {
      const fGroup = new THREE.Group();
      fGroup.position.set(fingerXs[f], -0.32, 0);
      handGroup.add(fGroup);

      const fGeo = new THREE.CylinderGeometry(0.042, 0.036, fingerLengths[f], 8);
      const fMesh = new THREE.Mesh(fGeo, skinMat);
      fMesh.position.y = -fingerLengths[f] / 2;
      fGroup.add(fMesh);

      // Knuckle joint
      const knuckleGeo = new THREE.SphereGeometry(0.048, 6, 6);
      const knuckle = new THREE.Mesh(knuckleGeo, skinMat);
      knuckle.position.y = 0;
      fGroup.add(knuckle);

      fingers.push(fGroup);
    }

    return { armGroup, forearmGroup, handGroup, thumbGroup, fingers };
  }

  const leftArm = createArm(true);
  const rightArm = createArm(false);
  characterGroup.add(leftArm.armGroup);
  characterGroup.add(rightArm.armGroup);

  // ==========================================================================
  // 4. ARTICULATED LEGS, QUADRICEPS, KNEES & COMBAT BOOTS
  // ==========================================================================
  function createLeg(isLeft: boolean) {
    const sign = isLeft ? -1 : 1;
    const legGroup = new THREE.Group();
    legGroup.position.set(sign * 0.46, 1.72, 0);

    // Thigh (Quadriceps with Vastus Lateralis Outer Sweep)
    const thighGeo = new THREE.CylinderGeometry(0.38, 0.31, 1.25, 18);
    const thigh = new THREE.Mesh(thighGeo, suitMat);
    thigh.position.y = -0.62;
    thigh.castShadow = true;
    legGroup.add(thigh);

    // Vastus Medialis ("Teardrop" Muscle bulge above inner knee)
    const teardropGeo = new THREE.SphereGeometry(0.18, 12, 12);
    const teardrop = new THREE.Mesh(teardropGeo, suitMat);
    teardrop.position.set(sign * -0.12, -0.98, 0.16);
    teardrop.scale.set(0.9, 1.4, 0.9);
    legGroup.add(teardrop);

    // Patella (Sculpted Kneecap & Tendon)
    const kneeGeo = new THREE.SphereGeometry(0.19, 12, 12);
    const knee = new THREE.Mesh(kneeGeo, suitMat);
    knee.position.set(0, -1.22, 0.12);
    legGroup.add(knee);

    // Shin & Calves (Gastrocnemius Athletic Bulge)
    const calfGeo = new THREE.CylinderGeometry(0.32, 0.24, 1.15, 16);
    const calf = new THREE.Mesh(calfGeo, redArmoredMat);
    calf.position.y = -1.78;
    calf.castShadow = true;
    legGroup.add(calf);

    // Reinforced Combat Shin Guard Plate
    const shinPlateGeo = new THREE.BoxGeometry(0.26, 0.85, 0.12);
    const shinPlate = new THREE.Mesh(shinPlateGeo, redArmoredMat);
    shinPlate.position.set(0, -1.75, 0.22);
    legGroup.add(shinPlate);

    // Gold Boot Collar Trim
    const bootCollarGeo = new THREE.CylinderGeometry(0.34, 0.32, 0.14, 16);
    const bootCollar = new THREE.Mesh(bootCollarGeo, goldMetallicMat);
    bootCollar.position.y = -1.28;
    legGroup.add(bootCollar);

    // Combat Foot & Lugged Rubber Tread Sole
    const footGroup = new THREE.Group();
    footGroup.position.set(0, -2.36, 0);
    legGroup.add(footGroup);

    const bootGeo = new THREE.BoxGeometry(0.42, 0.28, 0.82);
    const boot = new THREE.Mesh(bootGeo, redArmoredMat);
    boot.position.set(0, 0.08, 0.18);
    boot.castShadow = true;
    footGroup.add(boot);

    const soleGeo = new THREE.BoxGeometry(0.46, 0.1, 0.88);
    const sole = new THREE.Mesh(soleGeo, darkSoleMat);
    sole.position.set(0, -0.06, 0.18);
    footGroup.add(sole);

    return { legGroup, footGroup };
  }

  const leftLeg = createLeg(true);
  const rightLeg = createLeg(false);
  characterGroup.add(leftLeg.legGroup);
  characterGroup.add(rightLeg.legGroup);

  // ==========================================================================
  // 5. HIGH-FIDELITY CLOTH SIMULATION CAPE & SHOULDER CLASPS
  // ==========================================================================
  // Gold Shoulder Fibulae Clasps
  const claspGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.08, 16);
  claspGeo.rotateX(Math.PI / 2);
  const leftClasp = new THREE.Mesh(claspGeo, goldMetallicMat);
  leftClasp.position.set(-0.68, 4.32, 0.15);
  torsoGroup.add(leftClasp);

  const rightClasp = new THREE.Mesh(claspGeo, goldMetallicMat);
  rightClasp.position.set(0.68, 4.32, 0.15);
  torsoGroup.add(rightClasp);

  // Cape Cloth Simulation Geometry (18 horizontal cols x 36 vertical rows = 648 dynamic vertices)
  const capeWidth = 2.4;
  const capeHeight = 4.2;
  const capeCols = 18;
  const capeRows = 36;
  const capeGeo = new THREE.PlaneGeometry(capeWidth, capeHeight, capeCols, capeRows);
  const capeMesh = new THREE.Mesh(capeGeo, redCapeMat);
  capeMesh.position.set(0, 2.65, -0.68);
  capeMesh.castShadow = true;
  capeMesh.receiveShadow = true;
  characterGroup.add(capeMesh);

  // ==========================================================================
  // 6. SUPERSONIC SHOCKWAVE CONE, MACH RINGS & SPEED STREAKS
  // ==========================================================================
  const sonicRingsGroup = new THREE.Group();
  rootGroup.add(sonicRingsGroup);

  // Mach Vapor Cone (Prandtl-Glauert Singularity)
  const shockConeGeo = new THREE.ConeGeometry(5.4, 4.2, 32, 1, true);
  shockConeGeo.rotateX(-Math.PI / 2);
  const shockConeMat = new THREE.MeshBasicMaterial({
    color: 0xbae6fd,
    transparent: true,
    opacity: 0.0,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  const shockCone = new THREE.Mesh(shockConeGeo, shockConeMat);
  shockCone.position.set(0, 2.0, 1.0);
  sonicRingsGroup.add(shockCone);

  const ringGeo = new THREE.TorusGeometry(4.2, 0.16, 8, 36);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xe0f2fe,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
  });
  const sonicRing1 = new THREE.Mesh(ringGeo, ringMat);
  const sonicRing2 = new THREE.Mesh(ringGeo, ringMat.clone());
  sonicRing1.rotation.x = Math.PI / 2;
  sonicRing2.rotation.x = Math.PI / 2;
  sonicRingsGroup.add(sonicRing1);
  sonicRingsGroup.add(sonicRing2);

  // Explosive Instant Mach Sonic Boom Shockwave Ring
  const boomRingGeo = new THREE.RingGeometry(0.8, 2.4, 36);
  const boomRingMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
  });
  const instantBoomRing = new THREE.Mesh(boomRingGeo, boomRingMat);
  instantBoomRing.rotation.x = Math.PI / 2;
  sonicRingsGroup.add(instantBoomRing);

  // Hypersonic Speed Lines / Warp Streaks
  const streakCount = 90;
  const streakGeo = new THREE.BufferGeometry();
  const streakPositions = new Float32Array(streakCount * 3);
  for (let i = 0; i < streakCount; i++) {
    streakPositions[i * 3] = (Math.random() - 0.5) * 18;
    streakPositions[i * 3 + 1] = (Math.random() - 0.5) * 12 + 2;
    streakPositions[i * 3 + 2] = (Math.random() - 0.5) * 40;
  }
  streakGeo.setAttribute('position', new THREE.BufferAttribute(streakPositions, 3));
  const streakMat = new THREE.PointsMaterial({
    color: 0x93c5fd,
    size: 0.75,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
  });
  const speedStreaks = new THREE.Points(streakGeo, streakMat);
  rootGroup.add(speedStreaks);

  // ==========================================================================
  // 7. VOLUMETRIC HEAT VISION (TWIN PRECISION BEAMS FROM EYE PUPILS)
  // ==========================================================================
  const heatVisionGroup = new THREE.Group();
  rootGroup.add(heatVisionGroup);

  const laserLen = 220;
  // White plasma core
  const innerLaserGeo = new THREE.CylinderGeometry(0.045, 0.08, laserLen, 8);
  innerLaserGeo.rotateX(Math.PI / 2);
  innerLaserGeo.translate(0, 0, laserLen / 2);

  // Concentrated crimson-orange thermal halo
  const outerLaserGeo = new THREE.CylinderGeometry(0.12, 0.22, laserLen, 8);
  outerLaserGeo.rotateX(Math.PI / 2);
  outerLaserGeo.translate(0, 0, laserLen / 2);

  const innerLaserMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
  });
  const outerLaserMat = new THREE.MeshBasicMaterial({
    color: 0xff2a00,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const leftInnerLaser = new THREE.Mesh(innerLaserGeo, innerLaserMat);
  leftInnerLaser.position.set(-eyeSpacing, 0, 0);

  const rightInnerLaser = new THREE.Mesh(innerLaserGeo, innerLaserMat);
  rightInnerLaser.position.set(eyeSpacing, 0, 0);

  const leftOuterLaser = new THREE.Mesh(outerLaserGeo, outerLaserMat);
  leftOuterLaser.position.set(-eyeSpacing, 0, 0);

  const rightOuterLaser = new THREE.Mesh(outerLaserGeo, outerLaserMat);
  rightOuterLaser.position.set(eyeSpacing, 0, 0);

  // Iris ignition sparks
  const flareGeo = new THREE.SphereGeometry(0.09, 8, 8);
  const flareMat = new THREE.MeshBasicMaterial({
    color: 0xff6600,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
  });
  const leftFlare = new THREE.Mesh(flareGeo, flareMat);
  leftFlare.position.set(-eyeSpacing, 0, 0.1);
  const rightFlare = new THREE.Mesh(flareGeo, flareMat);
  rightFlare.position.set(eyeSpacing, 0, 0.1);

  heatVisionGroup.add(leftInnerLaser);
  heatVisionGroup.add(rightInnerLaser);
  heatVisionGroup.add(leftOuterLaser);
  heatVisionGroup.add(rightOuterLaser);
  heatVisionGroup.add(leftFlare);
  heatVisionGroup.add(rightFlare);

  // ==========================================================================
  // 8. FREEZE BREATH (VOLUMETRIC BLIZZARD CONE & ICE CRYSTALS FROM LIPS)
  // ==========================================================================
  const freezeGroup = new THREE.Group();
  rootGroup.add(freezeGroup);

  const frostConeGeo = new THREE.ConeGeometry(5.5, 30, 20, 1, true);
  frostConeGeo.rotateX(-Math.PI / 2);
  frostConeGeo.translate(0, 0, 15);
  const frostConeMat = new THREE.MeshBasicMaterial({
    color: 0xbae6fd,
    transparent: true,
    opacity: 0.0,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const frostConeMesh = new THREE.Mesh(frostConeGeo, frostConeMat);
  freezeGroup.add(frostConeMesh);

  const freezeCount = 240;
  const freezeGeo = new THREE.BufferGeometry();
  const freezePos = new Float32Array(freezeCount * 3);
  const freezeVels: { x: number; y: number; z: number; life: number }[] = [];

  for (let i = 0; i < freezeCount; i++) {
    freezePos[i * 3] = 0;
    freezePos[i * 3 + 1] = 4.4;
    freezePos[i * 3 + 2] = 1.0;
    freezeVels.push({
      x: (Math.random() - 0.5) * 8.0,
      y: (Math.random() - 0.5) * 5.0,
      z: 36 + Math.random() * 55,
      life: Math.random(),
    });
  }
  freezeGeo.setAttribute('position', new THREE.BufferAttribute(freezePos, 3));
  const freezeMat = new THREE.PointsMaterial({
    color: 0xe0f2fe,
    size: 1.3,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
  });
  const freezeParticles = new THREE.Points(freezeGeo, freezeMat);
  freezeGroup.add(freezeParticles);

  // ==========================================================================
  // 9. SOLAR CHARGE HARVESTING AURA
  // ==========================================================================
  const solarAuraGroup = new THREE.Group();
  rootGroup.add(solarAuraGroup);

  const auraGeo = new THREE.SphereGeometry(2.8, 16, 16);
  const auraMat = new THREE.MeshBasicMaterial({
    color: 0xfbbf24,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const auraMesh = new THREE.Mesh(auraGeo, auraMat);
  auraMesh.position.y = 2.4;
  solarAuraGroup.add(auraMesh);

  const solarCount = 75;
  const solarGeo = new THREE.BufferGeometry();
  const solarPos = new Float32Array(solarCount * 3);
  const solarAngles: { r: number; theta: number; speed: number; y: number }[] = [];
  for (let i = 0; i < solarCount; i++) {
    const r = 1.2 + Math.random() * 3.5;
    const theta = Math.random() * Math.PI * 2;
    const y = 0.5 + Math.random() * 4.0;
    solarPos[i * 3] = Math.cos(theta) * r;
    solarPos[i * 3 + 1] = y;
    solarPos[i * 3 + 2] = Math.sin(theta) * r;
    solarAngles.push({ r, theta, speed: 2.0 + Math.random() * 4.0, y });
  }
  solarGeo.setAttribute('position', new THREE.BufferAttribute(solarPos, 3));
  const solarMat = new THREE.PointsMaterial({
    color: 0xfef08a,
    size: 0.9,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
  });
  const solarParticles = new THREE.Points(solarGeo, solarMat);
  solarAuraGroup.add(solarParticles);

  // ==========================================================================
  // 10. GROUND SHOCKWAVE & IMPACT DUST
  // ==========================================================================
  const slamRingGeo = new THREE.RingGeometry(0.5, 1.8, 36);
  const slamRingMat = new THREE.MeshBasicMaterial({
    color: 0xf59e0b,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.0,
  });
  const slamRing = new THREE.Mesh(slamRingGeo, slamRingMat);
  slamRing.rotation.x = -Math.PI / 2;
  slamRing.position.y = 0.12;
  rootGroup.add(slamRing);

  const slamRing2Geo = new THREE.RingGeometry(1.0, 2.6, 36);
  const slamRing2Mat = new THREE.MeshBasicMaterial({
    color: 0xef4444,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.0,
  });
  const slamRing2 = new THREE.Mesh(slamRing2Geo, slamRing2Mat);
  slamRing2.rotation.x = -Math.PI / 2;
  slamRing2.position.y = 0.14;
  rootGroup.add(slamRing2);

  const triggerGroundSlamShockwave = () => {
    slamRing.scale.set(1, 1, 1);
    slamRing2.scale.set(0.6, 0.6, 0.6);
    slamRing.position.set(0, 0.12, 0);
    slamRing2.position.set(0, 0.14, 0);
  };

  // Combat punch impacts
  const punchImpactGroup = new THREE.Group();
  punchImpactGroup.position.set(0, 3.2, 2.0);
  rootGroup.add(punchImpactGroup);

  const punchRingGeo = new THREE.RingGeometry(0.2, 1.4, 24);
  const punchRingMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
  });
  const punchRing = new THREE.Mesh(punchRingGeo, punchRingMat);
  punchImpactGroup.add(punchRing);

  const punchFlashGeo = new THREE.SphereGeometry(0.7, 12, 12);
  const punchFlashMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
  });
  const punchFlash = new THREE.Mesh(punchFlashGeo, punchFlashMat);
  punchImpactGroup.add(punchFlash);

  // Ground super sprint dust
  const sprintDustCount = 35;
  const sprintDustGeo = new THREE.BufferGeometry();
  const sprintDustPos = new Float32Array(sprintDustCount * 3);
  for (let i = 0; i < sprintDustCount; i++) {
    sprintDustPos[i * 3] = (Math.random() - 0.5) * 1.8;
    sprintDustPos[i * 3 + 1] = 0.08 + Math.random() * 0.45;
    sprintDustPos[i * 3 + 2] = -0.5 - Math.random() * 3.2;
  }
  sprintDustGeo.setAttribute('position', new THREE.BufferAttribute(sprintDustPos, 3));
  const sprintDustMat = new THREE.PointsMaterial({
    color: 0x94a3b8,
    size: 0.65,
    transparent: true,
    opacity: 0.0,
    blending: THREE.NormalBlending,
  });
  const sprintDust = new THREE.Points(sprintDustGeo, sprintDustMat);
  rootGroup.add(sprintDust);

  let punchAnimTimer = 0;
  let punchComboIndex = 0;

  const triggerPunch = (comboStep: number = 0) => {
    punchComboIndex = comboStep % 3;
    punchAnimTimer = 0.28;
    punchRing.scale.set(0.4, 0.4, 0.4);
    punchRingMat.opacity = 1.0;
    punchFlashMat.opacity = 0.85;

    if (punchComboIndex === 0) {
      punchRingMat.color.setHex(0x38bdf8);
      punchImpactGroup.position.set(0.45, 3.4, 2.2);
    } else if (punchComboIndex === 1) {
      punchRingMat.color.setHex(0xf59e0b);
      punchImpactGroup.position.set(-0.45, 3.4, 2.2);
    } else {
      punchRingMat.color.setHex(0xef4444);
      punchImpactGroup.position.set(0, 3.2, 2.5);
    }
  };

  let instantBoomTimer = 0;
  const triggerInstantSonicBoom = () => {
    instantBoomTimer = 0.38;
    instantBoomRing.scale.set(1, 1, 1);
    boomRingMat.opacity = 1.0;
  };

  // ==========================================================================
  // 11. AAA LOCOMOTION, PROCEDURAL SKELETON BLEND & CLOTH SIMULATION
  // ==========================================================================
  let walkPhase = 0;
  let animTime = 0;
  let blinkTimer = 2.5;
  let blinkProgress = 0;
  const headWorldVec = new THREE.Vector3();

  const updatePose = (
    isFlying: boolean,
    isSupersonic: boolean,
    speed: number,
    delta: number,
    isFiringHeat: boolean,
    isFiringFreeze: boolean,
    isHeroLanding: boolean,
    landingProgress: number,
    isDiving: boolean = false,
    isSolarCharging: boolean = false,
    isWallRunning: boolean = false,
    barrelRollAngle: number = 0,
    isHoldingObject: boolean = false
  ) => {
    animTime += delta;

    // Organic Realistic Eye Blinking Simulation (every 2.5 - 4.5 seconds)
    blinkTimer -= delta;
    if (blinkTimer <= 0) {
      blinkProgress += delta * 14;
      if (blinkProgress >= 1.0) {
        blinkProgress = 0;
        blinkTimer = 2.5 + Math.random() * 2.0; // Next blink in 2.5-4.5s
      }
    }
    const blinkWeight = Math.sin(blinkProgress * Math.PI);
    leftUpperLid.rotation.x = -Math.PI / 2 + blinkWeight * (Math.PI / 2);
    rightUpperLid.rotation.x = -Math.PI / 2 + blinkWeight * (Math.PI / 2);

    // Mouth movement during Freeze Breath (part lips slightly)
    if (isFiringFreeze) {
      mouthGroup.position.y = 0.3 + Math.sin(animTime * 18) * 0.015;
      mouthGroup.scale.set(1.15, 1.25, 1.1);
    } else {
      mouthGroup.position.y = 0.32;
      mouthGroup.scale.set(1.0, 1.0, 1.0);
    }

    // Hand Fist Curl vs Open Finger Pose
    const fistTarget = (isSupersonic || punchAnimTimer > 0 || isHeroLanding || speed > 18) ? 1.0 : 0.0;
    // Curl thumb and fingers into combat fists
    leftArm.thumbGroup.rotation.x = THREE.MathUtils.lerp(leftArm.thumbGroup.rotation.x, fistTarget * 1.2, delta * 12);
    rightArm.thumbGroup.rotation.x = THREE.MathUtils.lerp(rightArm.thumbGroup.rotation.x, fistTarget * 1.2, delta * 12);
    for (let f = 0; f < 4; f++) {
      leftArm.fingers[f].rotation.x = THREE.MathUtils.lerp(leftArm.fingers[f].rotation.x, fistTarget * 1.5, delta * 14);
      rightArm.fingers[f].rotation.x = THREE.MathUtils.lerp(rightArm.fingers[f].rotation.x, fistTarget * 1.5, delta * 14);
    }

    // Instant Sonic Boom Ring Expansion
    if (instantBoomTimer > 0) {
      instantBoomTimer -= delta;
      const progress = 1.0 - instantBoomTimer / 0.38;
      const scale = 1.0 + progress * 13.5;
      instantBoomRing.scale.set(scale, scale, 1);
      boomRingMat.opacity = Math.max(0, 1.0 - progress * 1.3);
    } else {
      boomRingMat.opacity = 0.0;
    }

    // --- STATE 0: SPIDER-MAN STYLE VERTICAL WALL RUNNING ---
    if (isWallRunning) {
      characterGroup.position.y = 0;
      characterGroup.rotation.x = THREE.MathUtils.lerp(characterGroup.rotation.x, Math.PI / 2, delta * 18);
      characterGroup.rotation.z = THREE.MathUtils.lerp(characterGroup.rotation.z, 0, delta * 12);

      walkPhase += delta * 24;
      const legStride = Math.sin(walkPhase) * 1.25;
      leftLeg.legGroup.rotation.x = legStride;
      rightLeg.legGroup.rotation.x = -legStride;

      const armStride = -Math.sin(walkPhase) * 1.1;
      leftArm.armGroup.rotation.x = armStride;
      leftArm.armGroup.rotation.z = 0.18;
      rightArm.armGroup.rotation.x = -armStride;
      rightArm.armGroup.rotation.z = -0.18;

      headGroup.rotation.x = -0.45;
    }
    // --- STATE 1: HERO LANDING (Three-Point Stance) ---
    else if (isHeroLanding) {
      characterGroup.position.y = THREE.MathUtils.lerp(characterGroup.position.y, -0.6, delta * 14);
      characterGroup.rotation.x = THREE.MathUtils.lerp(characterGroup.rotation.x, 0.45, delta * 14);
      characterGroup.rotation.z = 0;

      rightLeg.legGroup.rotation.x = -1.35;
      rightLeg.legGroup.position.y = 1.2;
      leftLeg.legGroup.rotation.x = 0.75;
      leftLeg.legGroup.position.y = 1.5;

      rightArm.armGroup.rotation.x = -1.55;
      rightArm.armGroup.position.y = 3.6;
      leftArm.armGroup.rotation.x = 0.45;
      leftArm.armGroup.rotation.z = -0.3;

      headGroup.rotation.x = -0.4;
    }
    // --- STATE 2: GROUND LOCOMOTION (Idle Breathing, Athletic Walk, Super Sprint) ---
    else if (!isFlying) {
      characterGroup.position.y = THREE.MathUtils.lerp(characterGroup.position.y, 0, delta * 10);
      headGroup.rotation.x = THREE.MathUtils.lerp(headGroup.rotation.x, 0, delta * 8);
      rightLeg.legGroup.position.y = 1.72;
      leftLeg.legGroup.position.y = 1.72;
      rightArm.armGroup.position.y = 4.15;
      leftArm.armGroup.position.y = 4.15;

      if (speed > 1.0) {
        const isSuperSprint = isSupersonic || speed > 38;
        const isRunning = speed > 14 || isSuperSprint;
        const cycleSpeed = isSuperSprint ? 28 : isRunning ? 14 : 7.5;
        const strideRange = isSuperSprint ? 1.15 : isRunning ? 0.75 : 0.45;

        walkPhase += delta * cycleSpeed;

        const legSwing = Math.sin(walkPhase) * strideRange;
        leftLeg.legGroup.rotation.x = legSwing;
        rightLeg.legGroup.rotation.x = -legSwing;

        const armSwing = -Math.sin(walkPhase) * (strideRange * 0.85);
        leftArm.armGroup.rotation.x = armSwing;
        leftArm.armGroup.rotation.z = isSuperSprint ? 0.12 : 0.05;
        rightArm.armGroup.rotation.x = -armSwing;
        rightArm.armGroup.rotation.z = isSuperSprint ? -0.12 : -0.05;

        // Torso athletic lean & dynamic pelvic bounce
        const bounce = Math.abs(Math.sin(walkPhase)) * (isSuperSprint ? 0.3 : isRunning ? 0.22 : 0.12);
        torsoGroup.position.y = bounce;
        characterGroup.rotation.x = isSuperSprint ? 0.42 : isRunning ? 0.22 : 0.06;

        if (isSuperSprint) {
          sprintDustMat.opacity = Math.min(0.85, sprintDustMat.opacity + delta * 6);
          const dPos = sprintDustGeo.attributes.position.array as Float32Array;
          for (let i = 0; i < sprintDustCount; i++) {
            dPos[i * 3 + 2] -= delta * 18;
            if (dPos[i * 3 + 2] < -5.0) {
              dPos[i * 3 + 2] = -0.2 - Math.random() * 0.8;
              dPos[i * 3] = (Math.random() - 0.5) * 1.5;
            }
          }
          sprintDustGeo.attributes.position.needsUpdate = true;
        } else {
          sprintDustMat.opacity = Math.max(0, sprintDustMat.opacity - delta * 4);
        }
      } else {
        sprintDustMat.opacity = Math.max(0, sprintDustMat.opacity - delta * 4);
        // Realistic Idle Breathing (Chest expansion & subtle shoulder rise)
        torsoGroup.position.y = 0;
        characterGroup.rotation.x = THREE.MathUtils.lerp(characterGroup.rotation.x, 0, delta * 8);

        const breath = Math.sin(animTime * 2.2) * 0.024;
        upperThorax.scale.set(1 + breath, 1 + breath * 0.6, 1 + breath * 1.2);
        leftPec.position.z = 0.62 + breath * 0.8;
        rightPec.position.z = 0.62 + breath * 0.8;

        // Relaxed natural arm posture by thighs
        leftArm.armGroup.rotation.x = THREE.MathUtils.lerp(leftArm.armGroup.rotation.x, 0.05, delta * 8);
        leftArm.armGroup.rotation.z = THREE.MathUtils.lerp(leftArm.armGroup.rotation.z, -0.08, delta * 8);
        rightArm.armGroup.rotation.x = THREE.MathUtils.lerp(rightArm.armGroup.rotation.x, 0.05, delta * 8);
        rightArm.armGroup.rotation.z = THREE.MathUtils.lerp(rightArm.armGroup.rotation.z, 0.08, delta * 8);

        leftLeg.legGroup.rotation.x = THREE.MathUtils.lerp(leftLeg.legGroup.rotation.x, 0, delta * 8);
        rightLeg.legGroup.rotation.x = THREE.MathUtils.lerp(rightLeg.legGroup.rotation.x, 0, delta * 8);
      }
    }
    // --- STATE 3: AIR HOVER / LEVITATION ---
    else if (isFlying && speed < 8.0) {
      torsoGroup.position.y = 0;
      const hoverBob = Math.sin(animTime * 2.5) * 0.25;
      characterGroup.position.y = hoverBob;

      characterGroup.rotation.x = THREE.MathUtils.lerp(characterGroup.rotation.x, 0.05, delta * 8);

      leftArm.armGroup.rotation.x = THREE.MathUtils.lerp(leftArm.armGroup.rotation.x, -0.15, delta * 6);
      leftArm.armGroup.rotation.z = THREE.MathUtils.lerp(leftArm.armGroup.rotation.z, -0.25, delta * 6);
      rightArm.armGroup.rotation.x = THREE.MathUtils.lerp(rightArm.armGroup.rotation.x, -0.15, delta * 6);
      rightArm.armGroup.rotation.z = THREE.MathUtils.lerp(rightArm.armGroup.rotation.z, 0.25, delta * 6);

      leftLeg.legGroup.rotation.x = THREE.MathUtils.lerp(leftLeg.legGroup.rotation.x, 0.18, delta * 6);
      rightLeg.legGroup.rotation.x = THREE.MathUtils.lerp(rightLeg.legGroup.rotation.x, 0.24, delta * 6);
    }
    // --- STATE 4: AERODYNAMIC FLIGHT & SUPERSONIC DASH ---
    else {
      torsoGroup.position.y = 0;
      characterGroup.position.y = 0;

      characterGroup.rotation.z = THREE.MathUtils.lerp(
        characterGroup.rotation.z,
        barrelRollAngle,
        delta * 14
      );

      if (isDiving) {
        characterGroup.rotation.x = THREE.MathUtils.lerp(characterGroup.rotation.x, Math.PI * 0.78, delta * 14);
        leftArm.armGroup.rotation.x = Math.PI - 0.2;
        leftArm.armGroup.rotation.z = -0.06;
        rightArm.armGroup.rotation.x = Math.PI - 0.2;
        rightArm.armGroup.rotation.z = 0.06;
        headGroup.rotation.x = THREE.MathUtils.lerp(headGroup.rotation.x, -0.3, delta * 12);
      } else if (isSupersonic) {
        characterGroup.rotation.x = THREE.MathUtils.lerp(characterGroup.rotation.x, Math.PI / 2 - 0.06, delta * 9);
        // Supersonic double-fist aerodynamic thrust
        leftArm.armGroup.rotation.x = Math.PI - 0.12;
        leftArm.armGroup.rotation.z = 0.02;
        rightArm.armGroup.rotation.x = Math.PI - 0.12;
        rightArm.armGroup.rotation.z = -0.02;
        headGroup.rotation.x = THREE.MathUtils.lerp(headGroup.rotation.x, -0.22, delta * 10);
      } else {
        characterGroup.rotation.x = THREE.MathUtils.lerp(characterGroup.rotation.x, Math.PI / 2 - 0.06, delta * 8);
        rightArm.armGroup.rotation.x = Math.PI - 0.15;
        rightArm.armGroup.rotation.z = 0;
        leftArm.armGroup.rotation.x = 0.35;
        leftArm.armGroup.rotation.z = -0.15;
        headGroup.rotation.x = THREE.MathUtils.lerp(headGroup.rotation.x, -0.18, delta * 8);
      }

      leftLeg.legGroup.rotation.x = THREE.MathUtils.lerp(leftLeg.legGroup.rotation.x, 0.05, delta * 8);
      rightLeg.legGroup.rotation.x = THREE.MathUtils.lerp(rightLeg.legGroup.rotation.x, 0.05, delta * 8);
    }

    // Overhead Superhuman Lifting Stance (when holding a car or enemy)
    if (isHoldingObject) {
      leftArm.armGroup.rotation.x = Math.PI - 0.22;
      leftArm.armGroup.rotation.z = -0.32;
      rightArm.armGroup.rotation.x = Math.PI - 0.22;
      rightArm.armGroup.rotation.z = 0.32;
    }

    // Reposition Head Weapons (Heat Vision & Freeze Breath)
    headGroup.getWorldPosition(headWorldVec);
    rootGroup.worldToLocal(headWorldVec);

    heatVisionGroup.position.set(headWorldVec.x, headWorldVec.y + 0.14, headWorldVec.z + 0.34);
    heatVisionGroup.rotation.x = isDiving ? 0.35 : 0.0;

    freezeParticles.position.set(headWorldVec.x, headWorldVec.y - 0.12, headWorldVec.z + 0.34);
    freezeParticles.rotation.x = isDiving ? 0.35 : 0.0;

    // --- HIGH-FIDELITY CLOTH VERTEX WAVE SIMULATION ON CAPE ---
    const posAttr = capeGeo.attributes.position as THREE.BufferAttribute;
    const waveFreq = isSupersonic ? 40 : isDiving ? 32 : isFlying ? 20 : 6;
    const waveSpeed = animTime * waveFreq;

    for (let i = 0; i < posAttr.count; i++) {
      const y = posAttr.getY(i);
      const x = posAttr.getX(i);

      // Distance from shoulder clasps (top of cape y = +2.1)
      const distFromTop = Math.max(0, 2.1 - y) / 4.2;

      // Realistic turbulent wave fluttering with harmonic overlay
      let wave = Math.sin(waveSpeed + y * 4.2 + x * 2.5) * distFromTop;
      wave += Math.cos(waveSpeed * 1.6 + y * 2.8) * distFromTop * 0.42;

      if (isDiving) {
        posAttr.setZ(i, -0.7 - wave * 0.35);
      } else if (isSupersonic) {
        posAttr.setZ(i, -0.45 - wave * 0.25);
      } else if (isFlying) {
        posAttr.setZ(i, -0.55 - wave * 0.35);
      } else if (isHeroLanding) {
        posAttr.setZ(i, -0.2 + wave * 0.1);
      } else {
        posAttr.setZ(i, wave * 0.16);
      }
    }
    posAttr.needsUpdate = true;

    // --- SUPERSONIC MACH SHOCKWAVE CONE & RINGS ---
    if (isSupersonic) {
      shockConeMat.opacity = 0.55 + Math.sin(animTime * 24) * 0.18;
      const coneZ = isFlying ? (isDiving ? 2.5 : 3.0) : 1.0;
      const coneY = isFlying ? (isDiving ? 1.0 : 1.6) : 2.5;
      shockCone.position.set(0, coneY, coneZ);
      shockCone.rotation.x = isDiving ? -Math.PI / 3 : -Math.PI / 2;

      sonicRing1.material.opacity = 0.8;
      sonicRing2.material.opacity = 0.55;
      sonicRing1.position.set(0, coneY, coneZ - 3.5 - Math.sin(animTime * 18) * 1.5);
      sonicRing2.position.set(0, coneY, coneZ - 7.5 - Math.cos(animTime * 18) * 2.0);
    } else {
      shockConeMat.opacity = 0.0;
      sonicRing1.material.opacity = 0.0;
      sonicRing2.material.opacity = 0.0;
    }

    // --- HYPERSONIC SPEED WARP STREAKS ---
    if (speed > 25 || isSupersonic) {
      streakMat.opacity = isSupersonic ? 0.85 : Math.min(0.5, speed / 100);
      const posArray = streakGeo.attributes.position.array as Float32Array;
      const warpSpeed = (isSupersonic ? 180 : 80) * delta;

      for (let i = 0; i < streakCount; i++) {
        posArray[i * 3 + 2] -= warpSpeed;
        if (posArray[i * 3 + 2] < -35) {
          posArray[i * 3 + 2] = 35;
          posArray[i * 3] = (Math.random() - 0.5) * 18;
          posArray[i * 3 + 1] = (Math.random() - 0.5) * 12 + (isFlying ? 2 : 4);
        }
      }
      streakGeo.attributes.position.needsUpdate = true;
    } else {
      streakMat.opacity = 0.0;
    }

    // --- HEAT VISION VISUAL GLOW & LASERS ---
    if (isFiringHeat) {
      innerLaserMat.opacity = 1.0;
      outerLaserMat.opacity = 0.82;
      flareMat.opacity = 0.95;
      eyeMat.emissive.setHex(0xffeedd);
      eyeMat.emissiveIntensity = 4.0;
      const jitter = 0.92 + Math.sin(animTime * 60) * 0.08;
      leftOuterLaser.scale.set(jitter, jitter, 1.0);
      rightOuterLaser.scale.set(jitter, jitter, 1.0);
    } else {
      innerLaserMat.opacity = 0.0;
      outerLaserMat.opacity = 0.0;
      flareMat.opacity = 0.0;
      eyeMat.emissive.setHex(0x000000);
      eyeMat.emissiveIntensity = 0.0;
    }

    // --- FREEZE BREATH (VOLUMETRIC BLIZZARD CONE & ICE CRYSTALS) ---
    if (isFiringFreeze) {
      frostConeMat.opacity = 0.38 + Math.sin(animTime * 20) * 0.12;
      frostConeMesh.scale.set(
        1.0 + Math.sin(animTime * 26) * 0.1,
        1.0 + Math.cos(animTime * 26) * 0.1,
        1.0
      );
      freezeMat.opacity = 0.95;
      const positions = freezeGeo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < freezeCount; i++) {
        const vel = freezeVels[i];
        vel.life += delta * 2.8;
        if (vel.life > 1.0) {
          vel.life = 0;
          positions.setXYZ(i, 0, 0, 0);
        } else {
          const curZ = positions.getZ(i) + vel.z * delta;
          const spread = (curZ / 35) * 4.8;
          positions.setXYZ(i, vel.x * spread, vel.y * spread, curZ);
        }
      }
      positions.needsUpdate = true;
    } else {
      frostConeMat.opacity = 0.0;
      freezeMat.opacity = 0.0;
    }

    // --- SOLAR CHARGE CORONA & SPIRALS ---
    if (isSolarCharging) {
      auraMat.opacity = THREE.MathUtils.lerp(auraMat.opacity, 0.42 + Math.sin(animTime * 10) * 0.12, delta * 5);
      solarMat.opacity = THREE.MathUtils.lerp(solarMat.opacity, 0.9, delta * 6);
      const posArray = solarGeo.attributes.position.array as Float32Array;

      for (let i = 0; i < solarCount; i++) {
        const item = solarAngles[i];
        item.theta += item.speed * delta;
        item.r -= delta * 1.5;
        if (item.r < 0.4) {
          item.r = 2.5 + Math.random() * 2.5;
          item.y = 1.0 + Math.random() * 3.0;
        }
        posArray[i * 3] = Math.cos(item.theta) * item.r;
        posArray[i * 3 + 1] = item.y;
        posArray[i * 3 + 2] = Math.sin(item.theta) * item.r;
      }
      solarGeo.attributes.position.needsUpdate = true;
    } else {
      auraMat.opacity = THREE.MathUtils.lerp(auraMat.opacity, 0.0, delta * 4);
      solarMat.opacity = THREE.MathUtils.lerp(solarMat.opacity, 0.0, delta * 4);
    }

    // --- SUPER PUNCH COMBO ARM ANIMATION & IMPACT EXPANSION ---
    if (punchAnimTimer > 0) {
      punchAnimTimer -= delta;
      const punchProgress = 1 - Math.max(0, punchAnimTimer) / 0.28;
      const punchScale = 0.4 + punchProgress * 3.8;
      punchRing.scale.set(punchScale, punchScale, 1);
      punchRingMat.opacity = Math.max(0, 1.0 - punchProgress * 1.25);
      punchFlashMat.opacity = Math.max(0, 0.85 - punchProgress * 1.6);

      if (punchComboIndex === 0) {
        rightArm.armGroup.rotation.x = Math.PI - 0.12;
        rightArm.armGroup.rotation.z = -0.06;
        rightArm.armGroup.position.z = 0.45;
        leftArm.armGroup.rotation.x = -0.35;
        leftArm.armGroup.rotation.z = -0.22;
      } else if (punchComboIndex === 1) {
        leftArm.armGroup.rotation.x = Math.PI - 0.18;
        leftArm.armGroup.rotation.z = 0.42;
        leftArm.armGroup.position.z = 0.45;
        rightArm.armGroup.rotation.x = -0.35;
        rightArm.armGroup.rotation.z = 0.22;
      } else {
        rightArm.armGroup.rotation.x = Math.PI - 0.15;
        leftArm.armGroup.rotation.x = Math.PI - 0.15;
        rightArm.armGroup.rotation.z = -0.08;
        leftArm.armGroup.rotation.z = 0.08;
        rightArm.armGroup.position.z = 0.4;
        leftArm.armGroup.position.z = 0.4;
      }
    } else {
      punchRingMat.opacity = 0.0;
      punchFlashMat.opacity = 0.0;
      rightArm.armGroup.position.z = 0;
      leftArm.armGroup.position.z = 0;
    }
  };

  /**
   * GLTFLoader architecture hook (Requirement 9):
   * Allows hot-loading an external rigged character GLB model if supplied,
   * while falling back seamlessly to this AAA procedural sculpt.
   */
  const loadExternalModel = async (url: string): Promise<boolean> => {
    return new Promise((resolve) => {
      const loader = new GLTFLoader();
      loader.load(
        url,
        (gltf) => {
          // Remove procedural character meshes and bind external GLB model
          characterGroup.clear();
          const model = gltf.scene;
          model.scale.set(1.0, 1.0, 1.0);
          model.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });
          characterGroup.add(model);
          resolve(true);
        },
        undefined,
        (err) => {
          console.warn('External GLTF model not found, retaining AAA procedural sculpt:', err);
          resolve(false);
        }
      );
    });
  };

  return {
    group: rootGroup,
    characterGroup,
    eyesMesh,
    capeMesh,
    sonicRingsGroup,
    heatVisionGroup,
    freezeParticles,
    updatePose,
    triggerGroundSlamShockwave,
    triggerPunch,
    triggerInstantSonicBoom,
    loadExternalModel,
  };
}
