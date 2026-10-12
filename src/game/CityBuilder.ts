import * as THREE from 'three';
import { CityBuilding } from '../types/game';

export interface CityData {
  group: THREE.Group;
  buildings: CityBuilding[];
  dailyPlanetGlobe: THREE.Mesh | null;
  checkCollision: (x: number, y: number, z: number, radius?: number) => {
    hit: boolean;
    pushX: number;
    pushZ: number;
    normalX: number;
    normalZ: number;
    buildingHeight?: number;
    buildingX?: number;
    buildingZ?: number;
    buildingWidth?: number;
    buildingDepth?: number;
  };
  updateLOD?: (cameraPosition: THREE.Vector3) => void;
}

export function buildMetropolisCity(scene: THREE.Scene): CityData {
  const cityGroup = new THREE.Group();
  scene.add(cityGroup);

  const buildings: CityBuilding[] = [];
  const lodList: {
    x: number;
    z: number;
    mesh: THREE.Mesh;
    roof?: THREE.Mesh;
    antenna?: THREE.Mesh;
    baseGeo: THREE.BufferGeometry;
    lowGeo?: THREE.BufferGeometry;
    highShadow: boolean;
  }[] = [];
  let dailyPlanetGlobe: THREE.Mesh | null = null;

  // Ground plane (Asphalt covering quadrupled Metropolis)
  const groundGeo = new THREE.PlaneGeometry(2400, 2400, 48, 48);
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x161c28,
    roughness: 0.88,
    metalness: 0.1,
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  cityGroup.add(ground);

  // Sidewalks & Road Markings Canvas Texture
  const roadGridCanvas = document.createElement('canvas');
  roadGridCanvas.width = 1024;
  roadGridCanvas.height = 1024;
  const ctx = roadGridCanvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#1e2430';
    ctx.fillRect(0, 0, 1024, 1024);
    // Draw street lines
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 4;
    ctx.setLineDash([16, 16]);
    // Grid roads
    for (let i = 64; i < 1024; i += 128) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(1024, i);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 1024);
      ctx.stroke();
    }
  }

  // Window & Emissive texture for skyscrapers (Golden Hour / Twilight Glow)
  function createSkyscraperTextures(baseColor: string, litRatio: number = 0.65) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 512;
    const emitCanvas = document.createElement('canvas');
    emitCanvas.width = 256;
    emitCanvas.height = 512;

    const c = canvas.getContext('2d');
    const ec = emitCanvas.getContext('2d');
    if (c && ec) {
      c.fillStyle = baseColor;
      c.fillRect(0, 0, 256, 512);
      ec.fillStyle = '#000000';
      ec.fillRect(0, 0, 256, 512);

      const winCols = 8;
      const winRows = 32;
      const colW = 256 / winCols;
      const rowH = 512 / winRows;

      for (let r = 0; r < winRows; r++) {
        for (let k = 0; k < winCols; k++) {
          const isLit = Math.random() < litRatio;
          if (isLit) {
            const glow = Math.random() > 0.35 ? '#fde047' : '#f97316';
            c.fillStyle = glow;
            ec.fillStyle = glow;
          } else {
            c.fillStyle = '#070c14';
            ec.fillStyle = '#000000';
          }
          c.fillRect(k * colW + 4, r * rowH + 3, colW - 8, rowH - 6);
          ec.fillRect(k * colW + 4, r * rowH + 3, colW - 8, rowH - 6);
        }
      }
    }
    const map = new THREE.CanvasTexture(canvas);
    map.wrapS = THREE.RepeatWrapping;
    map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(1, 4);

    const emissiveMap = new THREE.CanvasTexture(emitCanvas);
    emissiveMap.wrapS = THREE.RepeatWrapping;
    emissiveMap.wrapT = THREE.RepeatWrapping;
    emissiveMap.repeat.set(1, 4);

    return { map, emissiveMap };
  }

  const texBlueGlass = createSkyscraperTextures('#172554', 0.68);
  const texDarkTower = createSkyscraperTextures('#0f172a', 0.52);
  const texWarmOffice = createSkyscraperTextures('#1e1b4b', 0.72);

  const matBlueGlass = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    roughness: 0.16,
    metalness: 0.85,
    map: texBlueGlass.map,
    emissive: 0xf59e0b,
    emissiveMap: texBlueGlass.emissiveMap,
    emissiveIntensity: 0.5,
  });

  const matDarkTower = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    roughness: 0.28,
    metalness: 0.7,
    map: texDarkTower.map,
    emissive: 0xfbbf24,
    emissiveMap: texDarkTower.emissiveMap,
    emissiveIntensity: 0.38,
  });

  const matWarmOffice = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.22,
    metalness: 0.65,
    map: texWarmOffice.map,
    emissive: 0xfde047,
    emissiveMap: texWarmOffice.emissiveMap,
    emissiveIntensity: 0.48,
  });

  // Neon Sign texture generator for Metropolis Entertainment District
  function createNeonSignTexture(text: string, neonColor: string) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const c = canvas.getContext('2d');
    if (c) {
      c.fillStyle = '#050811';
      c.fillRect(0, 0, 512, 128);
      c.strokeStyle = neonColor;
      c.lineWidth = 6;
      c.strokeRect(8, 8, 496, 112);

      c.font = 'bold 42px sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.shadowColor = neonColor;
      c.shadowBlur = 18;
      c.fillStyle = '#ffffff';
      c.fillText(text, 256, 64);
    }
    const tex = new THREE.CanvasTexture(canvas);
    return tex;
  }

  // Helipad Canvas Texture for High-rise rooftops
  const helipadCanvas = document.createElement('canvas');
  helipadCanvas.width = 256;
  helipadCanvas.height = 256;
  const hctx = helipadCanvas.getContext('2d');
  if (hctx) {
    hctx.fillStyle = '#1e293b';
    hctx.fillRect(0, 0, 256, 256);
    hctx.strokeStyle = '#facc15';
    hctx.lineWidth = 14;
    hctx.beginPath();
    hctx.arc(128, 128, 100, 0, Math.PI * 2);
    hctx.stroke();

    hctx.font = 'bold 120px sans-serif';
    hctx.textAlign = 'center';
    hctx.textBaseline = 'middle';
    hctx.fillStyle = '#facc15';
    hctx.fillText('H', 128, 128);
  }
  const helipadTex = new THREE.CanvasTexture(helipadCanvas);

  const neonSigns = [
    { text: 'METROPOLIS LIVE', color: '#ec4899' },
    { text: 'DAILY PLANET 24/7', color: '#38bdf8' },
    { text: 'LEXCORP FUTURE', color: '#06b6d4' },
    { text: 'S.T.A.R. LABS TECH', color: '#a855f7' },
    { text: 'CYBER METROPOLIS', color: '#eab308' },
    { text: 'WAYNE DYNAMICS', color: '#94a3b8' },
  ];

  // Reuse GPU buffers/materials across the procedural district. Each tower
  // remains a separate mesh so collisions, damage and named landmarks survive.
  const sharedTowerGeo = new THREE.BoxGeometry(1, 1, 1);
  const sharedRoofGeo = new THREE.BoxGeometry(1, 1, 1);
  const sharedRoofMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8 });
  const sharedAntennaGeo = new THREE.CylinderGeometry(0.4, 0.7, 18, 8);
  const sharedAntennaMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.85 });
  const sharedBeaconGeo = new THREE.SphereGeometry(0.8, 8, 8);
  const sharedBeaconMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });

  // Helper to add a building
  function addBuilding(
    x: number,
    z: number,
    w: number,
    d: number,
    h: number,
    material: THREE.Material,
    name?: string,
    isIconic: boolean = false,
    color?: string,
    district: string = 'downtown'
  ) {
    const geo = sharedTowerGeo;
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(x, h / 2, z);
    mesh.scale.set(w, h, d);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    cityGroup.add(mesh);

    // Rooftop rim
    const roof = new THREE.Mesh(sharedRoofGeo, sharedRoofMat);
    roof.position.set(x, h + 1, z);
    roof.scale.set(w * 0.94, 2, d * 0.94);
    cityGroup.add(roof);

    let antenna: THREE.Mesh | undefined = undefined;

    // High towers (>110m): Antennas with blinking red aviation beacons + Helipads
    if (h > 110 && !isIconic) {
      antenna = new THREE.Mesh(sharedAntennaGeo, sharedAntennaMat);
      antenna.position.set(x, h + 10, z);

      // Red aviation beacon tip
      const beaconTip = new THREE.Mesh(sharedBeaconGeo, sharedBeaconMat);
      beaconTip.position.y = 9;
      antenna.add(beaconTip);
      cityGroup.add(antenna);

      // Helipad on broad skyscrapers
      if (w >= 36 && d >= 36) {
        const heliGeo = new THREE.PlaneGeometry(24, 24);
        const heliMat = new THREE.MeshStandardMaterial({
          map: helipadTex,
          roughness: 0.5,
          metalness: 0.2,
        });
        const heliMesh = new THREE.Mesh(heliGeo, heliMat);
        heliMesh.rotation.x = -Math.PI / 2;
        heliMesh.position.set(x, h + 2.05, z);
        cityGroup.add(heliMesh);
      }
    }
    // Mid-rise towers (40 - 85m): Rooftop water tank or HVAC unit
    else if (h <= 85 && h >= 45 && !isIconic && (Math.abs(x) + Math.abs(z)) % 2 === 0) {
      const tankGeo = new THREE.CylinderGeometry(3.5, 3.5, 6, 12);
      const tankMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 });
      const tank = new THREE.Mesh(tankGeo, tankMat);
      tank.position.set(x + (w * 0.2), h + 4.5, z + (d * 0.2));
      cityGroup.add(tank);
    }

    // Neon District Facade Signs
    if (district === 'neon' || (x > 180 && z > -180 && z < 280 && Math.random() < 0.38)) {
      const signData = neonSigns[Math.floor(Math.random() * neonSigns.length)];
      const signTex = createNeonSignTexture(signData.text, signData.color);
      const signGeo = new THREE.PlaneGeometry(18, 4.5);
      const signMat = new THREE.MeshBasicMaterial({
        map: signTex,
        side: THREE.DoubleSide,
      });
      const signMesh = new THREE.Mesh(signGeo, signMat);
      // Mount on south or east face
      signMesh.position.set(x, h * 0.65, z + d / 2 + 0.3);
      cityGroup.add(signMesh);
    }

    buildings.push({ x, z, width: w, depth: d, height: h, name, isIconic, color });
    
    // Register in LOD management list
    lodList.push({
      x,
      z,
      mesh,
      roof,
      antenna,
      baseGeo: geo,
      highShadow: isIconic,
    });

    return mesh;
  }

  // --- 1. ICONIC: THE DAILY PLANET BUILDING ---
  const dpBase = addBuilding(0, 0, 50, 50, 160, matBlueGlass, 'Daily Planet', true, '#38bdf8');
  // Decorative tiered crown
  const dpCrownGeo = new THREE.BoxGeometry(38, 20, 38);
  const dpCrownMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.7, roughness: 0.3 });
  const dpCrown = new THREE.Mesh(dpCrownGeo, dpCrownMat);
  dpCrown.position.set(0, 170, 0);
  cityGroup.add(dpCrown);

  // Giant Golden Spinning Globe
  const globeGeo = new THREE.SphereGeometry(14, 24, 24);
  const globeMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    roughness: 0.2,
    metalness: 0.85,
    emissive: 0x78350f,
    emissiveIntensity: 0.2,
  });
  dailyPlanetGlobe = new THREE.Mesh(globeGeo, globeMat);
  dailyPlanetGlobe.position.set(0, 192, 0);
  cityGroup.add(dailyPlanetGlobe);

  // Daily Planet Ring
  const ringGeo = new THREE.TorusGeometry(20, 1.2, 12, 36);
  const ringMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.2, metalness: 0.9 });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI / 3;
  dailyPlanetGlobe.add(ring);

  // --- 2. ICONIC: LEXCORP TOWER ---
  const lexCorpMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.15,
    metalness: 0.9,
    emissive: 0x06b6d4,
    emissiveIntensity: 0.15,
  });
  addBuilding(120, -100, 55, 55, 210, lexCorpMat, 'LexCorp Tower', true, '#06b6d4');
  // Helipad on LexCorp
  const helipadGeo = new THREE.CylinderGeometry(16, 16, 2, 24);
  const helipadMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 });
  const helipad = new THREE.Mesh(helipadGeo, helipadMat);
  helipad.position.set(120, 211, -100);
  cityGroup.add(helipad);

  // --- 3. ICONIC: METROPOLIS POLICE DEPT HQ ---
  const policeMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.5, metalness: 0.5 });
  addBuilding(-120, 80, 48, 48, 80, policeMat, 'Metropolis Police HQ', true, '#3b82f6');

  // --- 4. ICONIC: METROPOLIS GRAND BANK ---
  const bankMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.6, metalness: 0.4 });
  addBuilding(-80, -90, 42, 42, 60, bankMat, 'Banco Central de Metrópolis', true, '#f59e0b');

  // --- 5. ICONIC: METROPOLIS HOSPITAL ---
  const hospitalMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.4, metalness: 0.2 });
  addBuilding(100, 120, 50, 45, 95, hospitalMat, 'Hospital General de Metrópolis', true, '#ef4444');

  // --- 6. CENTENNIAL PARK (GREEN OASIS) ---
  const parkGeo = new THREE.BoxGeometry(100, 0.8, 90);
  const parkMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.9 });
  const park = new THREE.Mesh(parkGeo, parkMat);
  park.position.set(-160, 0.4, -40);
  cityGroup.add(park);

  // Trees in park
  const trunkGeo = new THREE.CylinderGeometry(0.8, 1, 6, 8);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 });
  const leavesGeo = new THREE.SphereGeometry(4, 10, 10);
  const leavesMat = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.7 });

  for (let i = 0; i < 18; i++) {
    const tx = -160 + (Math.random() - 0.5) * 80;
    const tz = -40 + (Math.random() - 0.5) * 70;
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(tx, 3, tz);
    const leaves = new THREE.Mesh(leavesGeo, leavesMat);
    leaves.position.set(tx, 8, tz);
    cityGroup.add(trunk);
    cityGroup.add(leaves);
  }

  // --- 6.5. WEST RIVER & METROPOLIS BAYSIDE HARBOR ---
  const riverGeo = new THREE.PlaneGeometry(850, 2400);
  const riverMat = new THREE.MeshStandardMaterial({
    color: 0x0284c7,
    roughness: 0.12,
    metalness: 0.85,
  });
  const riverMesh = new THREE.Mesh(riverGeo, riverMat);
  riverMesh.rotation.x = -Math.PI / 2;
  riverMesh.position.set(-825, 0.25, 0);
  cityGroup.add(riverMesh);

  // Harbor Pier / Sea Wall
  const seawallGeo = new THREE.BoxGeometry(20, 4, 2400);
  const seawallMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.8 });
  const seawall = new THREE.Mesh(seawallGeo, seawallMat);
  seawall.position.set(-390, 2, 0);
  cityGroup.add(seawall);

  // --- METROPOLIS CLINTON SUSPENSION BRIDGE (CONNECTING METROPOLIS TO MAINLAND) ---
  const bridgeGroup = new THREE.Group();
  // Road Deck
  const deckGeo = new THREE.BoxGeometry(650, 4, 32);
  const deckMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7 });
  const bridgeDeck = new THREE.Mesh(deckGeo, deckMat);
  bridgeDeck.position.set(-725, 18, 50);
  bridgeDeck.receiveShadow = true;
  bridgeGroup.add(bridgeDeck);

  // Twin Red Suspension Towers
  const towerGeo = new THREE.BoxGeometry(10, 115, 36);
  const towerMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.5, metalness: 0.4 });
  const tower1 = new THREE.Mesh(towerGeo, towerMat);
  tower1.position.set(-580, 58, 50);
  tower1.castShadow = true;
  const tower2 = new THREE.Mesh(towerGeo, towerMat);
  tower2.position.set(-870, 58, 50);
  tower2.castShadow = true;
  bridgeGroup.add(tower1);
  bridgeGroup.add(tower2);

  // Suspension Main Cables
  const cableGeo = new THREE.CylinderGeometry(0.5, 0.5, 300, 8);
  cableGeo.rotateZ(Math.PI / 5.5);
  const cableMat = new THREE.MeshBasicMaterial({ color: 0xd97706 });
  const cable1 = new THREE.Mesh(cableGeo, cableMat);
  cable1.position.set(-725, 68, 66);
  const cable2 = new THREE.Mesh(cableGeo, cableMat);
  cable2.position.set(-725, 68, 34);
  bridgeGroup.add(cable1);
  bridgeGroup.add(cable2);
  cityGroup.add(bridgeGroup);

  // --- 6.6. ICONIC: S.T.A.R. LABS RESEARCH CAMPUS ---
  const starLabsMat = new THREE.MeshStandardMaterial({
    color: 0x0284c7,
    roughness: 0.2,
    metalness: 0.8,
    emissive: 0x0369a1,
    emissiveIntensity: 0.25,
  });
  addBuilding(320, -460, 68, 68, 110, starLabsMat, 'S.T.A.R. Labs Metropolis', true, '#38bdf8');
  // S.T.A.R. Labs Particle Accelerator Dome & Ring
  const domeGeo = new THREE.SphereGeometry(18, 16, 16);
  const domeMat = new THREE.MeshStandardMaterial({ color: 0xe0f2fe, roughness: 0.2, metalness: 0.7 });
  const starDome = new THREE.Mesh(domeGeo, domeMat);
  starDome.position.set(320, 118, -460);
  cityGroup.add(starDome);
  const accelRingGeo = new THREE.TorusGeometry(36, 1.8, 8, 28);
  const accelRingMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
  const accelRing = new THREE.Mesh(accelRingGeo, accelRingMat);
  accelRing.rotation.x = Math.PI / 2;
  accelRing.position.set(320, 114, -460);
  cityGroup.add(accelRing);

  // --- 6.7. ICONIC: WAYNE ENTERPRISES METROPOLIS TOWER ---
  const wayneMat = new THREE.MeshStandardMaterial({
    color: 0x09090b,
    roughness: 0.18,
    metalness: 0.92,
    emissive: 0x18181b,
  });
  addBuilding(-260, -520, 52, 52, 195, wayneMat, 'Wayne Enterprises', true, '#71717a');

  // --- 6.8. ICONIC: PLANTA DE ENERGÍA Y RED INDUSTRIAL ---
  const powerMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.7, metalness: 0.3 });
  addBuilding(360, 540, 75, 75, 70, powerMat, 'Complejo Energético de Metrópolis', true, '#f59e0b');
  // Cooling Tower
  const coolingGeo = new THREE.CylinderGeometry(14, 22, 55, 18);
  const coolingMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.8 });
  const coolingTower = new THREE.Mesh(coolingGeo, coolingMat);
  coolingTower.position.set(360, 97, 540);
  cityGroup.add(coolingTower);

  // --- 7. GRID SKYSCRAPERS (QUADRUPLED METROPOLIS EXPANSION: 110+ DISTRICT BLOCKS) ---
  const blockOffsets: [number, number][] = [
    // Core Downtown
    [-60, 60], [60, 60], [-60, -60], [60, -60],
    [-180, 120], [-180, 0], [-180, -120],
    [180, 120], [180, 0], [180, -120],
    [0, 140], [0, -140], [-120, -180], [120, 180],
    [-240, 60], [-240, -60], [240, 60], [240, -60],
    [-120, 180], [120, -180], [-200, 200], [200, -200],
    [-220, -180], [220, 180], [60, 220], [-60, -220],
    [-260, 160], [260, -160], [-160, 240], [160, -240],
    [-60, 180], [60, -180],

    // North Financial Corridor & Tech District
    [-60, -280], [60, -280], [-160, -280], [160, -280],
    [-260, -280], [260, -280], [0, -380], [-100, -380],
    [100, -380], [-200, -380], [200, -380], [-300, -380],
    [-60, -480], [60, -480], [-160, -480], [160, -480],
    [0, -580], [-120, -580], [120, -580], [-240, -580],
    [240, -580], [-80, -680], [80, -680], [-200, -680],
    [200, -680], [0, -780], [-140, -780], [140, -780],

    // East Midtown & Commercial Avenue
    [320, 60], [320, -60], [320, 160], [320, -160],
    [420, 0], [420, 100], [420, -100], [420, 200],
    [420, -200], [520, 60], [520, -60], [520, 160],
    [520, -160], [520, 260], [520, -260], [620, 0],
    [620, 120], [620, -120], [620, 240], [620, -240],
    [720, 60], [720, -60], [720, 180], [720, -180],

    // South Waterfront & Rail Yards
    [-60, 280], [60, 280], [-160, 280], [160, 280],
    [-260, 280], [260, 280], [0, 380], [-120, 380],
    [120, 380], [-220, 380], [220, 380], [-320, 380],
    [-60, 480], [60, 480], [-160, 480], [160, 480],
    [240, 480], [0, 580], [-120, 580], [120, 580],
    [-220, 580], [220, 580], [0, 680], [-140, 680],
    [140, 680], [260, 680], [-80, 780], [80, 780],

    // West Coastline Avenues (Bayside Blvds)
    [-320, 0], [-320, 100], [-320, -100], [-320, 200],
    [-320, -200], [-320, -300], [-320, 300], [-360, 60],
    [-360, -60], [-360, 160], [-360, -160], [-360, -240]
  ];

  blockOffsets.forEach(([bx, bz], index) => {
    // Avoid iconic buildings overlapping
    if (Math.hypot(bx, bz) < 30) return;
    if (Math.hypot(bx - 120, bz + 100) < 40) return;
    if (Math.hypot(bx + 120, bz - 80) < 40) return;
    if (Math.hypot(bx + 80, bz + 90) < 40) return;
    if (Math.hypot(bx - 100, bz - 120) < 40) return;
    if (Math.hypot(bx + 160, bz + 40) < 55) return; // park area
    if (Math.hypot(bx - 320, bz + 460) < 55) return; // star labs
    if (Math.hypot(bx + 260, bz + 520) < 50) return; // wayne ent
    if (Math.hypot(bx - 360, bz - 540) < 55) return; // power plant

    const height = 40 + ((index * 31) % 125);
    const width = 32 + ((index * 13) % 18);
    const depth = 32 + ((index * 17) % 18);

    const mat = (index % 3 === 0) ? matBlueGlass : (index % 3 === 1) ? matDarkTower : matWarmOffice;
    addBuilding(bx, bz, width, depth, height, mat);
  });

  // High-performance InstancedMesh Street Lamps across Metropolis Avenues (Golden sunset ambiance)
  const lampPoleGeo = new THREE.CylinderGeometry(0.2, 0.28, 8, 6);
  const lampPoleMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.4 });
  const bulbGeo = new THREE.SphereGeometry(0.65, 8, 8);
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xfde047 });

  const lampPositions: [number, number][] = [];
  for (let x = -560; x <= 560; x += 70) {
    for (let z = -560; z <= 560; z += 70) {
      if (Math.hypot(x, z) < 35) continue; // Skip Daily Planet center
      lampPositions.push([x + 16, z + 16]);
    }
  }

  const poleInstanced = new THREE.InstancedMesh(lampPoleGeo, lampPoleMat, lampPositions.length);
  const bulbInstanced = new THREE.InstancedMesh(bulbGeo, bulbMat, lampPositions.length);
  const dummy = new THREE.Object3D();

  for (let i = 0; i < lampPositions.length; i++) {
    const [lx, lz] = lampPositions[i];
    dummy.position.set(lx, 4, lz);
    dummy.updateMatrix();
    poleInstanced.setMatrixAt(i, dummy.matrix);

    dummy.position.set(lx, 8.2, lz);
    dummy.updateMatrix();
    bulbInstanced.setMatrixAt(i, dummy.matrix);
  }
  poleInstanced.instanceMatrix.needsUpdate = true;
  bulbInstanced.instanceMatrix.needsUpdate = true;
  cityGroup.add(poleInstanced);
  cityGroup.add(bulbInstanced);

  // Building collision resolver
  const checkCollision = (px: number, py: number, pz: number, radius: number = 2.0) => {
    let hit = false;
    let pushX = 0;
    let pushZ = 0;

    let normalX = 0;
    let normalZ = 0;
    let buildingHeight: number | undefined = undefined;
    let buildingX: number | undefined = undefined;
    let buildingZ: number | undefined = undefined;
    let buildingWidth: number | undefined = undefined;
    let buildingDepth: number | undefined = undefined;

    for (const b of buildings) {
      if (py > b.height) continue; // Flying above roof

      const halfW = b.width / 2 + radius;
      const halfD = b.depth / 2 + radius;

      const dx = px - b.x;
      const dz = pz - b.z;

      if (Math.abs(dx) < halfW && Math.abs(dz) < halfD) {
        hit = true;
        buildingHeight = b.height;
        buildingX = b.x;
        buildingZ = b.z;
        buildingWidth = b.width;
        buildingDepth = b.depth;

        // Calculate shallowest push-out axis
        const overlapX = halfW - Math.abs(dx);
        const overlapZ = halfD - Math.abs(dz);

        if (overlapX < overlapZ) {
          normalX = Math.sign(dx);
          pushX = normalX * overlapX;
        } else {
          normalZ = Math.sign(dz);
          pushZ = normalZ * overlapZ;
        }
        break;
      }
    }

    return {
      hit,
      pushX,
      pushZ,
      normalX,
      normalZ,
      buildingHeight,
      buildingX,
      buildingZ,
      buildingWidth,
      buildingDepth,
    };
  };

  // --- Dynamic LOD and Frustum/Distance Culling for Skyscraper Performance ---
  const updateLOD = (cameraPosition: THREE.Vector3) => {
    const camX = cameraPosition.x;
    const camZ = cameraPosition.z;

    for (let i = 0; i < lodList.length; i++) {
      const item = lodList[i];
      const dx = camX - item.x;
      const dz = camZ - item.z;
      const distSq = dx * dx + dz * dz;

      // Distance thresholds (squared)
      // Close distance: < 220 units (distSq < 48400) -> Full detail (roof, antenna, full shadow)
      // Mid distance: 220 - 450 units (distSq < 202500) -> Hide small antenna, keep main building and roof
      // Far distance: > 450 units -> Hide tiny details, disable dynamic shadow casting on generic blocks
      if (distSq > 202500) {
        // Far away: turn off roof and antenna
        if (item.antenna) item.antenna.visible = false;
        if (item.roof) item.roof.visible = false;
        if (!item.highShadow) {
          item.mesh.castShadow = false;
        }
      } else if (distSq > 48400) {
        // Mid range: keep roof, cull tiny antennas
        if (item.antenna) item.antenna.visible = false;
        if (item.roof) item.roof.visible = true;
        if (!item.highShadow) {
          item.mesh.castShadow = false;
        }
      } else {
        // Close range: full high fidelity!
        if (item.antenna) item.antenna.visible = true;
        if (item.roof) item.roof.visible = true;
        item.mesh.castShadow = true;
      }
    }
  };

  return {
    group: cityGroup,
    buildings,
    dailyPlanetGlobe,
    checkCollision,
    updateLOD,
  };
}
