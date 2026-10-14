import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CityBuilding, TimeOfDayMode } from '../types/game';

export interface CityData {
  group: THREE.Group;
  buildings: CityBuilding[];
  terrainMeshes: THREE.Mesh[];
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
  setTimeOfDay?: (mode: TimeOfDayMode) => void;
}

export function buildBogotaCity(scene: THREE.Scene): CityData {
  const cityGroup = new THREE.Group();
  scene.add(cityGroup);

  const buildings: CityBuilding[] = [];
  const terrainMeshes: THREE.Mesh[] = [];
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

  // Ground plane for the playable Bogotá basin. A subtle road atlas gives the
  // city a readable street rhythm without adding hundreds of extra meshes.
  const groundGeo = new THREE.PlaneGeometry(2400, 2400, 48, 48);
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.96,
    metalness: 0.02,
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  cityGroup.add(ground);

  // Low-contrast worn ground grain; actual road, curb and paint meshes are
  // laid down below so streets no longer look like a flat grid printed on grass.
  const groundGrainCanvas = document.createElement('canvas');
  groundGrainCanvas.width = 256;
  groundGrainCanvas.height = 256;
  const ctx = groundGrainCanvas.getContext('2d');
  if (ctx) {
    const pixels = ctx.createImageData(256, 256);
    for (let i = 0; i < pixels.data.length; i += 4) {
      const shade = 128 + Math.floor(Math.random() * 15);
      pixels.data[i] = shade;
      pixels.data[i + 1] = shade + 7;
      pixels.data[i + 2] = shade - 6;
      pixels.data[i + 3] = 255;
    }
    ctx.putImageData(pixels, 0, 0);
  }
  const groundGrainTexture = new THREE.CanvasTexture(groundGrainCanvas);
  groundGrainTexture.colorSpace = THREE.SRGBColorSpace;
  groundGrainTexture.wrapS = THREE.RepeatWrapping;
  groundGrainTexture.wrapT = THREE.RepeatWrapping;
  groundGrainTexture.repeat.set(24, 24);
  groundMat.map = groundGrainTexture;
  groundMat.needsUpdate = true;

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

  // Neon Sign texture generator for Bogotá's nightlife districts
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
    { text: 'BOGOTÁ DE NOCHE', color: '#ec4899' },
    { text: 'LA CANDELARIA', color: '#fbbf24' },
    { text: 'CHAPINERO VIVO', color: '#38bdf8' },
    { text: 'CAFÉ DE ALTURA', color: '#f97316' },
    { text: 'CARRERA SÉPTIMA', color: '#22c55e' },
    { text: 'DISTRITO CREATIVO', color: '#a855f7' },
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

  // --- PLAZA DE BOLÍVAR & CAPITOLIO NACIONAL ---
  const plazaStoneMat = new THREE.MeshStandardMaterial({ color: 0xb8ad98, roughness: 0.94 });
  const plaza = new THREE.Mesh(new THREE.PlaneGeometry(170, 150), plazaStoneMat);
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.set(0, 0.06, 0);
  cityGroup.add(plaza);

  const capitolioMat = new THREE.MeshStandardMaterial({ color: 0xc9b99b, roughness: 0.82 });
  addBuilding(0, 0, 92, 62, 38, capitolioMat, 'Capitolio Nacional · Plaza de Bolívar', true, '#f4c66a');

  // Portico, broad stone steps and the Capitolio's recognizable central dome.
  const columnGeo = new THREE.CylinderGeometry(1.2, 1.55, 24, 10);
  const columnMat = new THREE.MeshStandardMaterial({ color: 0xe5d7bd, roughness: 0.78 });
  for (let i = 0; i < 9; i++) {
    const column = new THREE.Mesh(columnGeo, columnMat);
    column.position.set(-34 + i * 8.5, 12.5, 32);
    column.castShadow = true;
    cityGroup.add(column);
  }
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(15, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x7c8892, roughness: 0.52, metalness: 0.25 })
  );
  dome.position.set(0, 39, 0);
  cityGroup.add(dome);

  // Colombian flag over the plaza.
  const flagCanvas = document.createElement('canvas');
  flagCanvas.width = 192;
  flagCanvas.height = 96;
  const flagCtx = flagCanvas.getContext('2d');
  if (flagCtx) {
    flagCtx.fillStyle = '#fcd116';
    flagCtx.fillRect(0, 0, 192, 48);
    flagCtx.fillStyle = '#003893';
    flagCtx.fillRect(0, 48, 192, 24);
    flagCtx.fillStyle = '#ce1126';
    flagCtx.fillRect(0, 72, 192, 24);
  }
  const flagTexture = new THREE.CanvasTexture(flagCanvas);
  flagTexture.colorSpace = THREE.SRGBColorSpace;
  const flagPole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.45, 30, 8),
    new THREE.MeshStandardMaterial({ color: 0xd6d3d1, metalness: 0.72, roughness: 0.3 })
  );
  flagPole.position.set(-58, 15, 48);
  cityGroup.add(flagPole);
  dailyPlanetGlobe = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 5),
    new THREE.MeshBasicMaterial({ map: flagTexture, side: THREE.DoubleSide })
  );
  dailyPlanetGlobe.position.set(-52, 26, 48);
  cityGroup.add(dailyPlanetGlobe);

  // --- 2. ICONIC: TORRE COLPATRIA ---
  const lexCorpMat = new THREE.MeshStandardMaterial({
    color: 0x667781,
    roughness: 0.3,
    metalness: 0.72,
    map: texBlueGlass.map,
    emissive: 0x321b27,
    emissiveMap: texBlueGlass.emissiveMap,
    emissiveIntensity: 0.2,
  });
  addBuilding(120, -100, 55, 55, 210, lexCorpMat, 'Torre Colpatria', true, '#ef4444');
  // Red aviation bands and helipad make the skyline landmark easy to spot.
  const colpatriaBandMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.5, metalness: 0.3 });
  for (const bandY of [66, 132, 198]) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(57, 2.8, 57), colpatriaBandMat);
    band.position.set(120, bandY, -100);
    cityGroup.add(band);
  }
  const helipadGeo = new THREE.CylinderGeometry(16, 16, 2, 24);
  const helipadMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 });
  const helipad = new THREE.Mesh(helipadGeo, helipadMat);
  helipad.position.set(120, 211, -100);
  cityGroup.add(helipad);

  // --- 3. ICONIC: ESTACIÓN DE POLICÍA DEL CENTRO ---
  const policeMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.5, metalness: 0.5 });
  addBuilding(-120, 80, 48, 48, 80, policeMat, 'Estación de Policía Centro', true, '#3b82f6');

  // --- 4. ICONIC: BANCO DE LA REPÚBLICA ---
  const bankMat = new THREE.MeshStandardMaterial({ color: 0x9a8060, roughness: 0.7, metalness: 0.28 });
  addBuilding(-80, -90, 42, 42, 60, bankMat, 'Banco de la República', true, '#f59e0b');

  // --- 5. ICONIC: HOSPITAL UNIVERSITARIO SAN IGNACIO ---
  const hospitalMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.4, metalness: 0.2 });
  addBuilding(100, 120, 50, 45, 95, hospitalMat, 'Hospital San Ignacio', true, '#ef4444');

  // --- 6. PARQUE METROPOLITANO SIMÓN BOLÍVAR ---
  const parkGeo = new THREE.BoxGeometry(190, 0.8, 170);
  const parkMat = new THREE.MeshStandardMaterial({ color: 0x24764b, roughness: 0.9 });
  const park = new THREE.Mesh(parkGeo, parkMat);
  park.position.set(-250, 0.4, -420);
  cityGroup.add(park);

  // Trees in park
  const trunkGeo = new THREE.CylinderGeometry(0.8, 1, 6, 8);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 });
  const leavesGeo = new THREE.SphereGeometry(4, 10, 10);
  const leavesMat = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.7 });

  for (let i = 0; i < 42; i++) {
    const tx = -250 + (Math.random() - 0.5) * 164;
    const tz = -420 + (Math.random() - 0.5) * 142;
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(tx, 3, tz);
    const leaves = new THREE.Mesh(leavesGeo, leavesMat);
    leaves.position.set(tx, 8, tz);
    cityGroup.add(trunk);
    cityGroup.add(leaves);
  }

  // --- RÍO BOGOTÁ & AEROPUERTO INTERNACIONAL EL DORADO ---
  const riverGeo = new THREE.PlaneGeometry(74, 2400);
  const riverMat = new THREE.MeshStandardMaterial({
    color: 0x397d91,
    roughness: 0.26,
    metalness: 0.42,
  });
  const riverMesh = new THREE.Mesh(riverGeo, riverMat);
  riverMesh.rotation.x = -Math.PI / 2;
  riverMesh.position.set(-1030, 0.18, 0);
  cityGroup.add(riverMesh);

  const riverBankMat = new THREE.MeshStandardMaterial({ color: 0x526b57, roughness: 0.95 });
  for (const bankX of [-1072, -988]) {
    const bank = new THREE.Mesh(new THREE.BoxGeometry(8, 0.7, 2400), riverBankMat);
    bank.position.set(bankX, 0.3, 0);
    cityGroup.add(bank);
  }

  // The airport is a low, broad landmark on the western edge of the map.
  const airportMat = new THREE.MeshStandardMaterial({ color: 0x75818a, roughness: 0.75, metalness: 0.15 });
  addBuilding(-790, -360, 118, 68, 22, airportMat, 'Aeropuerto Internacional El Dorado', true, '#38bdf8');
  const controlTowerMat = new THREE.MeshStandardMaterial({ color: 0xd5d0c5, roughness: 0.45, metalness: 0.2 });
  addBuilding(-895, -410, 24, 24, 82, controlTowerMat, 'Torre de Control El Dorado', true, '#facc15');
  const runway = new THREE.Mesh(
    new THREE.PlaneGeometry(380, 54),
    new THREE.MeshStandardMaterial({ color: 0x29343d, roughness: 0.88 })
  );
  runway.rotation.x = -Math.PI / 2;
  runway.position.set(-790, 0.22, -485);
  cityGroup.add(runway);
  const runwayMarking = new THREE.Mesh(
    new THREE.PlaneGeometry(340, 1.2),
    new THREE.MeshBasicMaterial({ color: 0xe8e8da })
  );
  runwayMarking.rotation.x = -Math.PI / 2;
  runwayMarking.position.set(-790, 0.28, -485);
  cityGroup.add(runwayMarking);
  for (let i = 0; i < 18; i++) {
    const light = new THREE.Mesh(
      new THREE.SphereGeometry(1, 6, 6),
      new THREE.MeshBasicMaterial({ color: i % 2 ? 0x38bdf8 : 0xfacc15 })
    );
    light.position.set(-970 + i * 21, 0.8, -458);
    cityGroup.add(light);
    const oppositeLight = light.clone();
    oppositeLight.position.z = -512;
    cityGroup.add(oppositeLight);
  }

  // --- TRANSMILENIO: CARRERA 10 & STATION PLATFORMS ---
  const transitRoad = new THREE.Mesh(
    new THREE.BoxGeometry(25, 0.45, 1500),
    new THREE.MeshStandardMaterial({ color: 0x29343d, roughness: 0.82 })
  );
  transitRoad.position.set(90, 0.2, 0);
  cityGroup.add(transitRoad);
  const busLaneMat = new THREE.MeshStandardMaterial({ color: 0x9f2732, roughness: 0.76 });
  for (const laneX of [84.5, 95.5]) {
    const busLane = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.12, 1450), busLaneMat);
    busLane.position.set(laneX, 0.48, 0);
    cityGroup.add(busLane);
  }
  const transitLineMat = new THREE.MeshBasicMaterial({ color: 0xf5e8bd });
  for (const laneX of [81.5, 98.5]) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.1, 1450), transitLineMat);
    line.position.set(laneX, 0.5, 0);
    cityGroup.add(line);
  }
  const platformMat = new THREE.MeshStandardMaterial({ color: 0xcfd5d1, roughness: 0.62 });
  const stationRoofMat = new THREE.MeshStandardMaterial({ color: 0xb91c2a, roughness: 0.48, metalness: 0.2 });
  for (const stationZ of [-480, -160, 160, 480]) {
    const platform = new THREE.Mesh(new THREE.BoxGeometry(7.2, 1.2, 56), platformMat);
    platform.position.set(90, 1.1, stationZ);
    cityGroup.add(platform);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(9.2, 1.2, 46), stationRoofMat);
    roof.position.set(90, 7, stationZ);
    cityGroup.add(roof);
    for (const pillarX of [88, 92]) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.9, 5.4, 0.9), columnMat);
      pillar.position.set(pillarX, 3.8, stationZ);
      cityGroup.add(pillar);
    }
  }

  // --- CERROS ORIENTALES, MONSERRATE & CERRO DE GUADALUPE ---
  const createAndeanRidge = (radius: number, height: number, seed: number) => {
    const geometry = new THREE.ConeGeometry(radius, height, 28, 12);
    const positions = geometry.getAttribute('position') as THREE.BufferAttribute;
    const colors: number[] = [];
    const color = new THREE.Color();
    for (let i = 0; i < positions.count; i++) {
      const px = positions.getX(i);
      const py = positions.getY(i);
      const pz = positions.getZ(i);
      const angle = Math.atan2(pz, px);
      const heightRatio = THREE.MathUtils.clamp((py + height / 2) / height, 0, 1);
      const ridgeNoise = Math.sin(angle * 5 + seed) * 0.075 + Math.cos(angle * 11 - seed) * 0.035;
      const radialScale = 1 + ridgeNoise * (1 - heightRatio * 0.75);
      positions.setXYZ(i, px * radialScale, py + Math.sin(px * 0.018 + seed) * Math.cos(pz * 0.016) * height * 0.012, pz * radialScale);
      color.setHex(heightRatio > 0.78 ? 0x777c75 : heightRatio > 0.46 ? 0x49694f : 0x365c47);
      const variation = 0.94 + (Math.sin(px * 0.045 + pz * 0.031 + seed) + 1) * 0.045;
      color.multiplyScalar(variation);
      colors.push(color.r, color.g, color.b);
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    const mountain = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: 1,
      flatShading: true,
    }));
    return mountain;
  };
  const ridgeSpecs = [
    { x: 1090, z: -760, radius: 330, height: 440 },
    { x: 1110, z: -460, radius: 380, height: 530 },
    { x: 1080, z: -130, radius: 425, height: 625 },
    { x: 1110, z: 235, radius: 390, height: 570 },
    { x: 1090, z: 590, radius: 350, height: 490 },
    { x: 1120, z: 885, radius: 280, height: 390 },
  ];
  ridgeSpecs.forEach(({ x, z, radius, height }, index) => {
    const ridge = createAndeanRidge(radius, height, index + 2);
    ridge.position.set(x, height / 2 - 8, z);
    ridge.scale.z = 0.72;
    ridge.castShadow = true;
    cityGroup.add(ridge);
    terrainMeshes.push(ridge);
  });

  const monserrateX = 790;
  const monserrateZ = -110;
  const monserrate = createAndeanRidge(138, 370, 17);
  monserrate.position.set(monserrateX, 178, monserrateZ);
  monserrate.castShadow = true;
  cityGroup.add(monserrate);
  terrainMeshes.push(monserrate);
  buildings.push({ x: monserrateX, z: monserrateZ, width: 2, depth: 2, height: 1, name: 'Monserrate', isIconic: true, color: '#22c55e' });

  const sanctuaryMat = new THREE.MeshStandardMaterial({ color: 0xf1eee4, roughness: 0.78 });
  const sanctuary = new THREE.Mesh(new THREE.BoxGeometry(28, 18, 40), sanctuaryMat);
  sanctuary.position.set(monserrateX, 363, monserrateZ);
  cityGroup.add(sanctuary);
  const sanctuaryRoof = new THREE.Mesh(new THREE.ConeGeometry(23, 11, 4), new THREE.MeshStandardMaterial({ color: 0x9c3c32, roughness: 0.78 }));
  sanctuaryRoof.position.set(monserrateX, 377, monserrateZ);
  sanctuaryRoof.rotation.y = Math.PI / 4;
  cityGroup.add(sanctuaryRoof);

  const cableMat = new THREE.LineBasicMaterial({ color: 0x26343b, transparent: true, opacity: 0.85 });
  const cablePath = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(300, 8, monserrateZ),
    new THREE.Vector3(520, 130, monserrateZ),
    new THREE.Vector3(monserrateX, 348, monserrateZ),
  ]);
  cityGroup.add(new THREE.Line(cablePath, cableMat));
  const cableCar = new THREE.Mesh(new THREE.BoxGeometry(10, 6, 8), new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.4, metalness: 0.3 }));
  cableCar.position.set(535, 146, monserrateZ);
  cityGroup.add(cableCar);

  const guadalupeX = 880;
  const guadalupeZ = 190;
  const guadalupe = createAndeanRidge(104, 290, 29);
  guadalupe.position.set(guadalupeX, 139, guadalupeZ);
  cityGroup.add(guadalupe);
  terrainMeshes.push(guadalupe);
  const cross = new THREE.Mesh(
    new THREE.BoxGeometry(3, 30, 3),
    new THREE.MeshStandardMaterial({ color: 0xe7e5df, metalness: 0.35, roughness: 0.55 })
  );
  cross.position.set(guadalupeX, 295, guadalupeZ);
  cityGroup.add(cross);
  const crossBar = new THREE.Mesh(new THREE.BoxGeometry(20, 3, 3), cross.material);
  crossBar.position.set(guadalupeX, 300, guadalupeZ);
  cityGroup.add(crossBar);
  buildings.push({ x: guadalupeX, z: guadalupeZ, width: 2, depth: 2, height: 1, name: 'Cerro de Guadalupe', isIconic: true, color: '#84cc16' });

  // --- 6.6. ICONIC: ESTADIO NEMESIO CAMACHO EL CAMPÍN ---
  const starLabsMat = new THREE.MeshStandardMaterial({
    color: 0x647987,
    roughness: 0.68,
    metalness: 0.22,
  });
  addBuilding(260, -390, 122, 96, 34, starLabsMat, 'Estadio El Campín', true, '#38bdf8');
  const pitch = new THREE.Mesh(new THREE.PlaneGeometry(70, 46), new THREE.MeshStandardMaterial({ color: 0x32734c, roughness: 0.96 }));
  pitch.rotation.x = -Math.PI / 2;
  pitch.position.set(260, 34.4, -390);
  cityGroup.add(pitch);
  const floodlightMat = new THREE.MeshBasicMaterial({ color: 0xfff0bd });
  for (const [fx, fz] of [[202, -435], [318, -435], [202, -345], [318, -345]]) {
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.8, 48, 8), sharedAntennaMat);
    mast.position.set(fx, 24, fz);
    cityGroup.add(mast);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(9, 3, 2), floodlightMat);
    lamp.position.set(fx, 49, fz);
    cityGroup.add(lamp);
  }

  // --- 6.7. ICONIC: SUBESTACIÓN DE ENERGÍA DEL CENTRO ---
  const powerMat = new THREE.MeshStandardMaterial({ color: 0x59646a, roughness: 0.76, metalness: 0.36 });
  addBuilding(360, 540, 88, 76, 64, powerMat, 'Subestación de Energía del Centro', true, '#f59e0b');
  const transformerMat = new THREE.MeshStandardMaterial({ color: 0xb88238, roughness: 0.68, metalness: 0.36 });
  for (const tx of [326, 360, 394]) {
    const transformer = new THREE.Mesh(new THREE.BoxGeometry(18, 16, 15), transformerMat);
    transformer.position.set(tx, 8, 590);
    cityGroup.add(transformer);
  }

  // --- 7. BARRIOS, MANZANAS Y TORRES DE BOGOTÁ ---
  const blockOffsets: [number, number][] = [];
  for (let gridX = -6; gridX <= 6; gridX++) {
    for (let gridZ = -6; gridZ <= 6; gridZ++) {
      blockOffsets.push([gridX * 120, gridZ * 120]);
    }
  }
  type BlockStyle = 'historic' | 'brick' | 'modern';
  type BlockFootprint = { x: number; z: number; width: number; depth: number; height: number };
  type BlockPlacement = { x: number; z: number; scale: number; quarterTurns: number; footprints: BlockFootprint[] };
  const layouts: Record<BlockStyle, BlockFootprint[]> = {
    historic: [
      { x: -24, z: -23, width: 19, depth: 19, height: 14 }, { x: 0, z: -23, width: 19, depth: 19, height: 17 },
      { x: 24, z: -23, width: 19, depth: 19, height: 15 }, { x: -24, z: 23, width: 19, depth: 19, height: 16 },
      { x: 0, z: 23, width: 19, depth: 19, height: 14 }, { x: 24, z: 23, width: 19, depth: 19, height: 18 },
    ],
    brick: [
      { x: -22, z: -22, width: 37, depth: 37, height: 29 }, { x: 22, z: -22, width: 37, depth: 37, height: 39 },
      { x: -22, z: 22, width: 37, depth: 37, height: 34 }, { x: 22, z: 22, width: 37, depth: 37, height: 26 },
    ],
    modern: [
      { x: -22, z: -22, width: 32, depth: 34, height: 70 }, { x: 21, z: -22, width: 32, depth: 34, height: 94 },
      { x: -21, z: 21, width: 31, depth: 34, height: 83 }, { x: 22, z: 21, width: 31, depth: 34, height: 58 },
    ],
  };
  const blockAssets: Record<BlockStyle, BlockPlacement[]> = { historic: [], brick: [], modern: [] };
  const blockColors: Record<BlockStyle, string> = { historic: '#a85c36', brick: '#8b4631', modern: '#57717a' };
  const fallbackMaterials: Record<BlockStyle, THREE.Material> = {
    historic: new THREE.MeshStandardMaterial({ color: 0xa85c36, roughness: 0.88 }),
    brick: new THREE.MeshStandardMaterial({ color: 0x8b4631, roughness: 0.86 }),
    modern: new THREE.MeshStandardMaterial({ color: 0x57717a, roughness: 0.36, metalness: 0.48 }),
  };
  const excludedSites = [
    { x: 0, z: 0, radius: 155 }, { x: 120, z: -100, radius: 74 }, { x: -120, z: 80, radius: 68 },
    { x: -80, z: -90, radius: 68 }, { x: 100, z: 120, radius: 74 }, { x: -250, z: -420, radius: 145 },
    { x: 260, z: -390, radius: 118 }, { x: -790, z: -360, radius: 160 }, { x: 360, z: 540, radius: 90 },
    { x: 790, z: -110, radius: 195 }, { x: 880, z: 190, radius: 155 },
  ];

  blockOffsets.forEach(([bx, bz], index) => {
    if (excludedSites.some((site) => Math.hypot(bx - site.x, bz - site.z) < site.radius)) return;
    if (bx >= 720 && Math.abs(bz) <= 1000) return; // Leave the eastern edge for the Cerros Orientales.
    if (Math.abs(bx - 90) < 72 && Math.abs(bz) < 770) return; // Keep the TransMilenio trunk clear.
    const style: BlockStyle = Math.hypot(bx, bz) < 405
      ? 'historic'
      : (bz < -360 && index % 3 === 0) || bx > 360 ? 'modern' : 'brick';
    const scale = [0.96, 1.0, 1.035][index % 3];
    const quarterTurns = index % 4;
    const angle = quarterTurns * Math.PI / 2;
    const cos = Math.round(Math.cos(angle));
    const sin = Math.round(Math.sin(angle));
    const footprints = layouts[style].map((footprint) => {
      const localX = footprint.x * scale;
      const localZ = footprint.z * scale;
      const rotated = quarterTurns % 2 !== 0;
      return {
        x: bx + localX * cos + localZ * sin,
        z: bz - localX * sin + localZ * cos,
        width: (rotated ? footprint.depth : footprint.width) * scale,
        depth: (rotated ? footprint.width : footprint.depth) * scale,
        height: footprint.height * scale,
      };
    });
    blockAssets[style].push({ x: bx, z: bz, scale, quarterTurns, footprints });
    footprints.forEach((footprint) => buildings.push({ ...footprint, isIconic: false, color: blockColors[style] }));
  });

  const loadBlockInstances = (style: BlockStyle, fileName: string) => {
    const placements = blockAssets[style];
    if (placements.length === 0) return;
    const addFallback = () => {
      if (!cityGroup.parent) return;
      const all = placements.flatMap((placement) => placement.footprints);
      const fallback = new THREE.InstancedMesh(sharedTowerGeo, fallbackMaterials[style], all.length);
      const transform = new THREE.Object3D();
      all.forEach((footprint, index) => {
        transform.position.set(footprint.x, footprint.height / 2, footprint.z);
        transform.scale.set(footprint.width, footprint.height, footprint.depth);
        transform.updateMatrix();
        fallback.setMatrixAt(index, transform.matrix);
      });
      fallback.instanceMatrix.needsUpdate = true;
      fallback.castShadow = true;
      fallback.receiveShadow = true;
      cityGroup.add(fallback);
    };

    new GLTFLoader().load(`/models/${fileName}`, (gltf) => {
      if (!cityGroup.parent) return;
      gltf.scene.updateMatrixWorld(true);
      const sources: THREE.Mesh[] = [];
      gltf.scene.traverse((child) => { if (child instanceof THREE.Mesh) sources.push(child); });
      if (sources.length === 0) { addFallback(); return; }
      sources.forEach((source) => {
        const instances = new THREE.InstancedMesh(source.geometry, source.material, placements.length);
        const blockMatrix = new THREE.Matrix4();
        const instanceMatrix = new THREE.Matrix4();
        const position = new THREE.Vector3();
        const scale = new THREE.Vector3();
        const rotation = new THREE.Quaternion();
        const tone = new THREE.Color();
        placements.forEach((placement, index) => {
          position.set(placement.x, 0, placement.z);
          scale.setScalar(placement.scale);
          rotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), placement.quarterTurns * Math.PI / 2);
          blockMatrix.compose(position, rotation, scale);
          instanceMatrix.multiplyMatrices(blockMatrix, source.matrixWorld);
          instances.setMatrixAt(index, instanceMatrix);
          tone.setRGB(0.96 + (index % 4) * 0.012, 0.96 + (index % 3) * 0.01, 0.96);
          instances.setColorAt(index, tone);
        });
        instances.instanceMatrix.needsUpdate = true;
        if (instances.instanceColor) instances.instanceColor.needsUpdate = true;
        instances.castShadow = true;
        instances.receiveShadow = true;
        cityGroup.add(instances);
      });
    }, undefined, (error) => {
      console.warn('Could not load ' + fileName + '; using low-detail building proxies.', error);
      addFallback();
    });
  };

  loadBlockInstances('historic', 'bogota-la-candelaria-block.glb');
  loadBlockInstances('brick', 'bogota-brick-midrise-block.glb');
  loadBlockInstances('modern', 'bogota-modern-block.glb');

  // Street surfaces are real geometry now: asphalt, curbs, broad sidewalks,
  // broken lane paint and zebra crossings replace the old painted grid texture.
  const streetCoordinates: number[] = [];
  for (let street = -6; street <= 5; street++) {
    const coordinate = street * 120 + 60;
    if (Math.abs(coordinate) < 145) continue; // Keep the historic core pedestrian-first.
    streetCoordinates.push(coordinate);
  }
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x343a3d, roughness: 0.96 });
  const sidewalkMat = new THREE.MeshStandardMaterial({ color: 0x9a988d, roughness: 0.94 });
  const curbMat = new THREE.MeshStandardMaterial({ color: 0xbbb6a7, roughness: 0.88 });
  const roadUnitGeo = new THREE.BoxGeometry(1, 1, 1);
  const roadInstanceCount = streetCoordinates.length * 2;
  const roadSurfaces = new THREE.InstancedMesh(roadUnitGeo, roadMat, roadInstanceCount);
  const sidewalks = new THREE.InstancedMesh(roadUnitGeo, sidewalkMat, roadInstanceCount * 2);
  const curbs = new THREE.InstancedMesh(roadUnitGeo, curbMat, roadInstanceCount * 4);
  const transform = new THREE.Object3D();
  let roadIndex = 0;
  let sidewalkIndex = 0;
  let curbIndex = 0;
  const addStreet = (coordinate: number, axis: 'x' | 'z', width: number) => {
    const isVertical = axis === 'z';
    transform.position.set(isVertical ? coordinate : 0, 0.035, isVertical ? 0 : coordinate);
    transform.scale.set(isVertical ? width : 2200, 0.08, isVertical ? 2200 : width);
    transform.updateMatrix();
    roadSurfaces.setMatrixAt(roadIndex++, transform.matrix);
    for (const side of [-1, 1]) {
      const edgeOffset = width / 2 + 2.8;
      transform.position.set(
        isVertical ? coordinate + side * edgeOffset : 0,
        0.09,
        isVertical ? 0 : coordinate + side * edgeOffset
      );
      transform.scale.set(isVertical ? 5.6 : 2200, 0.16, isVertical ? 2200 : 5.6);
      transform.updateMatrix();
      sidewalks.setMatrixAt(sidewalkIndex++, transform.matrix);

      const curbOffset = width / 2 + 0.18;
      transform.position.set(
        isVertical ? coordinate + side * curbOffset : 0,
        0.15,
        isVertical ? 0 : coordinate + side * curbOffset
      );
      transform.scale.set(isVertical ? 0.36 : 2200, 0.26, isVertical ? 2200 : 0.36);
      transform.updateMatrix();
      curbs.setMatrixAt(curbIndex++, transform.matrix);
    }
  };
  streetCoordinates.forEach((coordinate) => {
    const avenue = Math.abs(coordinate / 60) % 3 === 0;
    const width = avenue ? 20 : 14;
    addStreet(coordinate, 'z', width);
    addStreet(coordinate, 'x', width);
  });
  roadSurfaces.count = roadIndex;
  sidewalks.count = sidewalkIndex;
  curbs.count = curbIndex;
  roadSurfaces.instanceMatrix.needsUpdate = true;
  sidewalks.instanceMatrix.needsUpdate = true;
  curbs.instanceMatrix.needsUpdate = true;
  roadSurfaces.receiveShadow = true;
  sidewalks.receiveShadow = true;
  curbs.castShadow = true;
  cityGroup.add(roadSurfaces, sidewalks, curbs);

  const paintMat = new THREE.MeshBasicMaterial({ color: 0xe9e6d9 });
  const paintGeo = new THREE.BoxGeometry(1, 1, 1);
  const roadDashes = new THREE.InstancedMesh(paintGeo, paintMat, streetCoordinates.length * 2 * 88);
  let dashIndex = 0;
  streetCoordinates.forEach((coordinate) => {
    for (let along = -1080; along <= 1080; along += 26) {
      const blocked = Math.hypot(coordinate - 0, along - 0) < 160 ||
        Math.hypot(coordinate + 250, along + 420) < 120 ||
        Math.hypot(coordinate - 260, along + 390) < 100;
      if (blocked) continue;
      transform.position.set(coordinate, 0.092, along);
      transform.scale.set(0.16, 0.018, 7.5);
      transform.updateMatrix();
      roadDashes.setMatrixAt(dashIndex++, transform.matrix);
      transform.position.set(along, 0.092, coordinate);
      transform.scale.set(7.5, 0.018, 0.16);
      transform.updateMatrix();
      roadDashes.setMatrixAt(dashIndex++, transform.matrix);
    }
  });
  roadDashes.count = dashIndex;
  roadDashes.instanceMatrix.needsUpdate = true;
  cityGroup.add(roadDashes);

  const crosswalks = new THREE.InstancedMesh(paintGeo, paintMat, streetCoordinates.length * streetCoordinates.length * 4);
  let crosswalkIndex = 0;
  for (let row = 0; row < streetCoordinates.length; row += 2) {
    for (let column = 0; column < streetCoordinates.length; column += 2) {
      const x = streetCoordinates[column];
      const z = streetCoordinates[row];
      if (Math.hypot(x, z) < 180 || Math.hypot(x + 250, z + 420) < 150) continue;
      for (let stripe = 0; stripe < 7; stripe++) {
        const offset = (stripe - 3) * 1.45;
        transform.position.set(x + offset, 0.095, z);
        transform.scale.set(0.62, 0.02, 9);
        transform.updateMatrix();
        crosswalks.setMatrixAt(crosswalkIndex++, transform.matrix);
        transform.position.set(x, 0.095, z + offset);
        transform.scale.set(9, 0.02, 0.62);
        transform.updateMatrix();
        crosswalks.setMatrixAt(crosswalkIndex++, transform.matrix);
      }
    }
  }
  crosswalks.count = crosswalkIndex;
  crosswalks.instanceMatrix.needsUpdate = true;
  cityGroup.add(crosswalks);

  // Warm Bogotá streetlights stay inexpensive through instancing.
  const lampPoleGeo = new THREE.CylinderGeometry(0.2, 0.28, 8, 6);
  const lampPoleMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.4 });
  const bulbGeo = new THREE.SphereGeometry(0.65, 8, 8);
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xfde047 });

  const lampPositions: [number, number][] = [];
  for (let x = -560; x <= 560; x += 70) {
    for (let z = -560; z <= 560; z += 70) {
      if (Math.hypot(x, z) < 35) continue; // Keep Plaza de Bolívar open
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

  const setTimeOfDay = (mode: TimeOfDayMode) => {
    if (mode === 'cyber-night') {
      matBlueGlass.emissiveIntensity = 1.05;
      matDarkTower.emissiveIntensity = 0.85;
      matWarmOffice.emissiveIntensity = 0.95;
      lexCorpMat.emissiveIntensity = 0.55;
      starLabsMat.emissiveIntensity = 0.65;
      bulbMat.color.setHex(0x38bdf8);
      riverMat.color.setHex(0x082f49);
    } else if (mode === 'daylight') {
      matBlueGlass.emissiveIntensity = 0.15;
      matDarkTower.emissiveIntensity = 0.12;
      matWarmOffice.emissiveIntensity = 0.15;
      lexCorpMat.emissiveIntensity = 0.1;
      starLabsMat.emissiveIntensity = 0.15;
      bulbMat.color.setHex(0xe2e8f0);
      riverMat.color.setHex(0x0ea5e9);
    } else {
      // Bogotá's clear high-altitude golden hour.
      matBlueGlass.emissiveIntensity = 0.5;
      matDarkTower.emissiveIntensity = 0.38;
      matWarmOffice.emissiveIntensity = 0.48;
      lexCorpMat.emissiveIntensity = 0.18;
      starLabsMat.emissiveIntensity = 0.25;
      bulbMat.color.setHex(0xfde047);
      riverMat.color.setHex(0x397d91);
    }
  };

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
    terrainMeshes,
    dailyPlanetGlobe,
    checkCollision,
    updateLOD,
    setTimeOfDay,
  };
}
