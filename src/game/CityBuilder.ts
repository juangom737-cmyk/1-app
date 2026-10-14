import * as THREE from 'three';
import { CityBuilding, TimeOfDayMode } from '../types/game';

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
  setTimeOfDay?: (mode: TimeOfDayMode) => void;
}

export function buildBogotaCity(scene: THREE.Scene): CityData {
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

  // Sidewalks & Road Markings Canvas Texture
  const roadGridCanvas = document.createElement('canvas');
  roadGridCanvas.width = 1024;
  roadGridCanvas.height = 1024;
  const ctx = roadGridCanvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#717a72';
    ctx.fillRect(0, 0, 1024, 1024);
    // Local streets and broad avenues, laid out over the basin.
    ctx.setLineDash([]);
    ctx.strokeStyle = '#35414a';
    ctx.lineWidth = 7;
    for (let i = 32; i < 1024; i += 52) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(1024, i);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 1024);
      ctx.stroke();
    }

    ctx.strokeStyle = '#27343c';
    ctx.lineWidth = 13;
    for (let i = 16; i < 1024; i += 208) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(1024, i);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 1024);
      ctx.stroke();
    }

    ctx.strokeStyle = '#e7c76a';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([7, 9]);
    for (let i = 16; i < 1024; i += 208) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(1024, i);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 1024);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }
  const roadGridTexture = new THREE.CanvasTexture(roadGridCanvas);
  roadGridTexture.colorSpace = THREE.SRGBColorSpace;
  groundMat.map = roadGridTexture;
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
    const platform = new THREE.Mesh(new THREE.BoxGeometry(15, 1.2, 56), platformMat);
    platform.position.set(90, 1.1, stationZ);
    cityGroup.add(platform);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(17, 1.2, 46), stationRoofMat);
    roof.position.set(90, 7, stationZ);
    cityGroup.add(roof);
    for (const pillarX of [83, 97]) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.9, 5.4, 0.9), columnMat);
      pillar.position.set(pillarX, 3.8, stationZ);
      cityGroup.add(pillar);
    }
  }

  // --- CERROS ORIENTALES, MONSERRATE & CERRO DE GUADALUPE ---
  const foothillMat = new THREE.MeshStandardMaterial({ color: 0x365c47, roughness: 0.98, flatShading: true });
  const ridgeMat = new THREE.MeshStandardMaterial({ color: 0x274839, roughness: 1, flatShading: true });
  const ridgeSpecs = [
    { x: 1080, z: -420, radius: 310, height: 470 },
    { x: 1120, z: -80, radius: 360, height: 560 },
    { x: 1100, z: 310, radius: 330, height: 500 },
  ];
  ridgeSpecs.forEach(({ x, z, radius, height }, index) => {
    const ridge = new THREE.Mesh(new THREE.ConeGeometry(radius, height, 9, 4), index === 1 ? ridgeMat : foothillMat);
    ridge.position.set(x, height / 2 - 8, z);
    ridge.scale.z = 0.72;
    ridge.castShadow = true;
    cityGroup.add(ridge);
  });

  const monserrateX = 790;
  const monserrateZ = -110;
  const monserrate = new THREE.Mesh(
    new THREE.ConeGeometry(138, 370, 10, 4),
    new THREE.MeshStandardMaterial({ color: 0x42674a, roughness: 1, flatShading: true })
  );
  monserrate.position.set(monserrateX, 178, monserrateZ);
  monserrate.castShadow = true;
  cityGroup.add(monserrate);
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
  const guadalupe = new THREE.Mesh(
    new THREE.ConeGeometry(104, 290, 9, 4),
    new THREE.MeshStandardMaterial({ color: 0x4f6846, roughness: 1, flatShading: true })
  );
  guadalupe.position.set(guadalupeX, 139, guadalupeZ);
  cityGroup.add(guadalupe);
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

    // Chapinero and the northern business corridor
    [-60, -280], [60, -280], [-160, -280], [160, -280],
    [-260, -280], [260, -280], [0, -380], [-100, -380],
    [100, -380], [-200, -380], [200, -380], [-300, -380],
    [-60, -480], [60, -480], [-160, -480], [160, -480],
    [0, -580], [-120, -580], [120, -580], [-240, -580],
    [240, -580], [-80, -680], [80, -680], [-200, -680],
    [200, -680], [0, -780], [-140, -780], [140, -780],

    // Eastern commercial districts
    [320, 60], [320, -60], [320, 160], [320, -160],
    [420, 0], [420, 100], [420, -100], [420, 200],
    [420, -200], [520, 60], [520, -60], [520, 160],
    [520, -160], [520, 260], [520, -260], [620, 0],
    [620, 120], [620, -120], [620, 240], [620, -240],
    [720, 60], [720, -60], [720, 180], [720, -180],

    // Southern neighborhoods
    [-60, 280], [60, 280], [-160, 280], [160, 280],
    [-260, 280], [260, 280], [0, 380], [-120, 380],
    [120, 380], [-220, 380], [220, 380], [-320, 380],
    [-60, 480], [60, 480], [-160, 480], [160, 480],
    [240, 480], [0, 580], [-120, 580], [120, 580],
    [-220, 580], [220, 580], [0, 680], [-140, 680],
    [140, 680], [260, 680], [-80, 780], [80, 780],

    // Western neighborhoods near the Río Bogotá
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
    if (Math.hypot(bx + 250, bz + 420) < 132) return; // Parque Simón Bolívar
    if (Math.hypot(bx - 260, bz + 390) < 100) return; // Estadio El Campín
    if (Math.hypot(bx + 790, bz + 360) < 135) return; // Aeropuerto El Dorado
    if (Math.hypot(bx - 360, bz - 540) < 65) return; // energy substation

    const height = 40 + ((index * 31) % 125);
    const width = 32 + ((index * 13) % 18);
    const depth = 32 + ((index * 17) % 18);

    const mat = (index % 3 === 0) ? matBlueGlass : (index % 3 === 1) ? matDarkTower : matWarmOffice;
    addBuilding(bx, bz, width, depth, height, mat);
  });

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
    dailyPlanetGlobe,
    checkCollision,
    updateLOD,
    setTimeOfDay,
  };
}
