import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { PowerType, CityBuilding, TrafficCar, Mission } from '../types/game';
import { buildMetropolisCity, CityData } from '../game/CityBuilder';
import { TrafficSystem } from '../game/TrafficSystem';
import { createSupermanCharacter, SupermanMeshController } from '../game/SupermanCharacter';
import { CrimeManager } from '../game/CrimeManager';
import { NPCSystem } from '../game/NPCSystem';
import { audioService } from '../services/AudioService';
import { setupPostProcessing } from '../game/PostProcessingEffects';
import { PhysicsEngine } from '../game/PhysicsEngine';
import { DestructionSystem } from '../game/DestructionSystem';
import { CombatSystem } from '../game/CombatSystem';

interface Metropolis3DSceneProps {
  onUpdateState: (state: {
    playerX: number;
    playerZ: number;
    altMeters: number;
    speedKmh: number;
    mach: number;
    isFlying: boolean;
    isSupersonic: boolean;
    solarEnergy: number;
    health: number;
    buildings: CityBuilding[];
    trafficCars: TrafficCar[];
    activeMission: Mission | null;
    currentMissionIndex: number;
    allMissions: Mission[];
    isHoldingObject?: boolean;
    hasLockedTarget?: boolean;
    comboStep?: number;
  }) => void;
  activePower: PowerType | null;
  xrayActive: boolean;
  onMissionCompleted: (hopeGain: number) => void;
  externalMove: { dx: number; dz: number };
  externalAscend: boolean;
  externalDescend: boolean;
  externalSupersonic: boolean;
  externalPowerTrigger: PowerType | null;
  toggleFlightTrigger: number;
  missionIndexToSwitch: number | null;
  onMissionSwitched: () => void;
}

export const Metropolis3DScene: React.FC<Metropolis3DSceneProps> = ({
  onUpdateState,
  activePower,
  xrayActive,
  onMissionCompleted,
  externalMove,
  externalAscend,
  externalDescend,
  externalSupersonic,
  externalPowerTrigger,
  toggleFlightTrigger,
  missionIndexToSwitch,
  onMissionSwitched,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // References for scene lifecycle
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const animFrameIdRef = useRef<number | null>(null);

  const cityDataRef = useRef<CityData | null>(null);
  const trafficRef = useRef<TrafficSystem | null>(null);
  const supermanRef = useRef<SupermanMeshController | null>(null);
  const crimeRef = useRef<CrimeManager | null>(null);
  const npcRef = useRef<NPCSystem | null>(null);
  const punchComboRef = useRef<number>(0);
  const physicsRef = useRef<PhysicsEngine | null>(null);
  const destructionRef = useRef<DestructionSystem | null>(null);
  const combatRef = useRef<CombatSystem | null>(null);

  // Player physics state
  const posRef = useRef({ x: 0, y: 120, z: 80 }); // Start flying above city
  const velRef = useRef({ x: 0, y: 0, z: 0 });
  const rotYRef = useRef(0);
  const pitchRef = useRef(0);
  const isFlyingRef = useRef(true);
  const isSupersonicRef = useRef(false);
  const solarEnergyRef = useRef(98);
  const healthRef = useRef(100);

  // Input states
  const keysRef = useRef<{ [key: string]: boolean }>({});
  const isMouseDownRef = useRef(false);
  const isRightMouseDownRef = useRef(false);
  const isDoubleTapWActiveRef = useRef(false);
  const lastWPressTimeRef = useRef(0);
  const isDivingRef = useRef(false);
  const currentLookAtRef = useRef(new THREE.Vector3(0, 120, 80));
  const mousePosRef = useRef({ x: 0, y: 0 });
  const cameraPitchRef = useRef(0.15);
  const cameraYawRef = useRef(0);
  const isHeroLandingRef = useRef(false);
  const heroLandingTimerRef = useRef(0);
  const cameraShakeTimerRef = useRef(0);
  const cameraShakeIntensityRef = useRef(0);
  const wasSupersonicLastFrameRef = useRef(false);
  const isWallRunningRef = useRef(false);
  const wallRunStrideTimerRef = useRef(0);
  const barrelRollAngleRef = useRef(0);

  // Performance optimization pre-allocated vectors to prevent GC allocations in 60fps loop
  const tempCamTargetRef = useRef(new THREE.Vector3());
  const tempLookTargetRef = useRef(new THREE.Vector3());
  const throttleCounterRef = useRef(0);
  const xrayActiveRef = useRef(xrayActive);

  // Toggle flight externally
  useEffect(() => {
    if (toggleFlightTrigger > 0) {
      isFlyingRef.current = !isFlyingRef.current;
      if (!isFlyingRef.current) {
        posRef.current.y = 1.0;
        velRef.current.y = 0;
      } else {
        velRef.current.y = 15;
      }
    }
  }, [toggleFlightTrigger]);

  // Mission switch externally
  useEffect(() => {
    if (missionIndexToSwitch !== null && crimeRef.current) {
      crimeRef.current.switchMission(missionIndexToSwitch);
      onMissionSwitched();
    }
  }, [missionIndexToSwitch, onMissionSwitched]);

  // X-Ray Structural Scanner Effect: makes building walls translucent wireframe
  useEffect(() => {
    xrayActiveRef.current = xrayActive;
    if (cityDataRef.current) {
      cityDataRef.current.group.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material) {
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          mats.forEach((m) => {
            if (m instanceof THREE.MeshStandardMaterial || m instanceof THREE.MeshBasicMaterial) {
              m.wireframe = xrayActive;
              if (xrayActive) {
                m.transparent = true;
                m.opacity = 0.42;
              } else {
                m.transparent = false;
                m.opacity = 1.0;
              }
              m.needsUpdate = true;
            }
          });
        }
      });
    }
  }, [xrayActive]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // --- THREE.JS SETUP ---
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x38bdf8); // Sky blue
    scene.fog = new THREE.FogExp2(0x93c5fd, 0.0018); // Soft atmospheric depth

    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.5, 95000);
    cameraRef.current = camera;

    // Integrated Radeon graphics: avoid high-DPI + MSAA + bloom at the same time.
    const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    rendererRef.current = renderer;
    renderer.setPixelRatio(1);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // --- POST-PROCESSING (Bloom for Heat Vision & Motion Blur for Supersonic) ---
    const postProcessing = setupPostProcessing(renderer, scene, camera);

    // --- LIGHTING (Cinematic Golden Hour / Atardecer Dorado & ACES Tone Mapping) ---
    const hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x451a03, 1.15); // Twilight cyan sky, warm amber ground bounce
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xffa257, 3.2); // Warm golden sunset sun
    sunLight.position.set(1600, 750, -1800); // Low grazing angle for long dramatic sunset shadows
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 50;
    sunLight.shadow.camera.far = 4500;
    sunLight.shadow.camera.left = -700;
    sunLight.shadow.camera.right = 700;
    sunLight.shadow.camera.top = 700;
    sunLight.shadow.camera.bottom = -700;
    sunLight.shadow.bias = -0.0004;
    scene.add(sunLight);

    // Warm Sunset Rim Light (accentuating building edges & superhero silhouette)
    const rimLight = new THREE.DirectionalLight(0xf59e0b, 0.85);
    rimLight.position.set(-1200, 400, 1400);
    scene.add(rimLight);

    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;

    // --- CELESTIAL SPACE ELEMENTS (INFINITE SOLAR SYSTEM: EARTH, MOON, MARS, SATURN, SUN) ---
    // 1. Cosmic Twinkling Starfield (Thousands of deep space stars)
    const starCount = 4500;
    const starGeo = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = 12000 + Math.random() * 25000;
      const sinPhi = Math.sin(phi);
      starPositions[i * 3] = r * sinPhi * Math.cos(theta);
      starPositions[i * 3 + 1] = Math.abs(r * Math.cos(phi)) + 150;
      starPositions[i * 3 + 2] = r * sinPhi * Math.sin(theta);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 4.0,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
    });
    const starField = new THREE.Points(starGeo, starMat);
    scene.add(starField);

    // 2. Planet Earth Sphere beneath Metropolis (Curved Horizon)
    const earthCurvatureGeo = new THREE.SphereGeometry(14000, 64, 64);
    const earthCurvatureMat = new THREE.MeshStandardMaterial({
      color: 0x0c2744,
      roughness: 0.65,
      metalness: 0.35,
    });
    const earthSphere = new THREE.Mesh(earthCurvatureGeo, earthCurvatureMat);
    earthSphere.position.set(0, -14000, 0);
    scene.add(earthSphere);

    // Atmospheric Limb Glow (cyan arc hugging Earth when viewed from orbit)
    const atmoGlowGeo = new THREE.RingGeometry(2400, 4200, 64);
    atmoGlowGeo.rotateX(-Math.PI / 2);
    const atmoGlowMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.0,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const atmoGlow = new THREE.Mesh(atmoGlowGeo, atmoGlowMat);
    atmoGlow.position.set(0, 8, 0);
    scene.add(atmoGlow);

    // 3. The Moon (Luna) with craters
    const moonGroup = new THREE.Group();
    moonGroup.position.set(-4200, 5800, -5600);
    const moonGeo = new THREE.SphereGeometry(320, 32, 32);
    const moonMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.9,
      metalness: 0.08,
    });
    const moonMesh = new THREE.Mesh(moonGeo, moonMat);
    moonGroup.add(moonMesh);
    // Crater details on the moon
    const craterGeo = new THREE.RingGeometry(24, 42, 16);
    const craterMat = new THREE.MeshBasicMaterial({ color: 0x94a3b8, side: THREE.DoubleSide });
    for (let c = 0; c < 5; c++) {
      const cr = new THREE.Mesh(craterGeo, craterMat);
      cr.position.set((c - 2) * 60, (c % 2 === 0 ? 50 : -50), 310);
      moonGroup.add(cr);
    }
    scene.add(moonGroup);

    // 4. Mars (Marte) - The Red Planet with polar ice cap
    const marsGroup = new THREE.Group();
    marsGroup.position.set(9800, 8500, -11000);
    const marsGeo = new THREE.SphereGeometry(260, 32, 32);
    const marsMat = new THREE.MeshStandardMaterial({
      color: 0xc2410c,
      roughness: 0.82,
      metalness: 0.12,
    });
    const marsMesh = new THREE.Mesh(marsGeo, marsMat);
    marsGroup.add(marsMesh);

    const iceCapGeo = new THREE.SphereGeometry(75, 16, 16);
    const iceCapMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const iceCap = new THREE.Mesh(iceCapGeo, iceCapMat);
    iceCap.position.set(0, 245, 0);
    marsGroup.add(iceCap);
    scene.add(marsGroup);

    // 5. Saturn with Majestic Planetary Ring System (Saturno con sus Anillos)
    const saturnGroup = new THREE.Group();
    saturnGroup.position.set(-16000, 14000, -20000);
    const saturnGeo = new THREE.SphereGeometry(680, 36, 36);
    const saturnMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.52,
      metalness: 0.22,
    });
    const saturnMesh = new THREE.Mesh(saturnGeo, saturnMat);
    saturnGroup.add(saturnMesh);

    const saturnRingsGeo = new THREE.RingGeometry(880, 1650, 64);
    saturnRingsGeo.rotateX(Math.PI / 2.3);
    saturnRingsGeo.rotateZ(0.28);
    const saturnRingsMat = new THREE.MeshBasicMaterial({
      color: 0xfde047,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.88,
      blending: THREE.AdditiveBlending,
    });
    const saturnRings = new THREE.Mesh(saturnRingsGeo, saturnRingsMat);
    saturnGroup.add(saturnRings);
    scene.add(saturnGroup);

    // 6. Blazing Solar Star (Massive celestial sun)
    const sunGroup = new THREE.Group();
    sunGroup.position.set(24000, 28000, -32000);

    const sunSphereGeo = new THREE.SphereGeometry(2200, 32, 32);
    const sunSphereMat = new THREE.MeshBasicMaterial({ color: 0xfffbeb });
    const sunSphere = new THREE.Mesh(sunSphereGeo, sunSphereMat);
    sunGroup.add(sunSphere);

    const corona1Geo = new THREE.RingGeometry(2300, 4200, 32);
    const corona1Mat = new THREE.MeshBasicMaterial({
      color: 0xfde047,
      transparent: true,
      opacity: 0.88,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const corona1 = new THREE.Mesh(corona1Geo, corona1Mat);
    corona1.lookAt(-24000, -28000, 32000);
    sunGroup.add(corona1);

    const corona2Geo = new THREE.RingGeometry(4100, 7000, 32);
    const corona2Mat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const corona2 = new THREE.Mesh(corona2Geo, corona2Mat);
    corona2.lookAt(-24000, -28000, 32000);
    sunGroup.add(corona2);
    scene.add(sunGroup);

    // --- BUILD METROPOLIS CITY ---
    const cityData = buildMetropolisCity(scene);
    cityDataRef.current = cityData;

    // --- TRAFFIC SYSTEM ---
    const traffic = new TrafficSystem(scene);
    trafficRef.current = traffic;

    // --- SUPERMAN RIG ---
    const superman = createSupermanCharacter(scene);
    supermanRef.current = superman;

    // --- CRIME & EMERGENCY MANAGER ---
    const crime = new CrimeManager(scene);
    crimeRef.current = crime;

    // --- NPC PEDESTRIANS SYSTEM ---
    const npcs = new NPCSystem(scene);
    npcRef.current = npcs;

    // --- RAPIER 3D PHYSICS, DESTRUCTION & COMBAT SYSTEMS ---
    const physics = new PhysicsEngine(scene);
    physicsRef.current = physics;
    physics.init().then(() => {
      cityData.buildings.forEach((b) => {
        physics.addBuildingCollider(b.x, b.z, b.width, b.depth, b.height);
      });
    });

    const destruction = new DestructionSystem(scene, physics);
    destructionRef.current = destruction;

    const combat = new CombatSystem(scene, physics, destruction, crime, traffic);
    combatRef.current = combat;

    // Graphics presets: F7 cycles Balanced/Performance/High. F8 toggles live stats.
    // Deliberately keep gameplay keys and abilities untouched.
    const graphicsProfiles = [
      { name: 'Equilibrado', ratio: 1.0, shadow: 1024 },
      { name: 'Rendimiento', ratio: 0.8, shadow: 512 },
      { name: 'Alta calidad', ratio: 1.25, shadow: 2048 },
    ] as const;
    let currentGraphicsProfile = 0;
    const stats = document.createElement('div');
    stats.style.cssText = 'position:absolute;right:12px;bottom:12px;z-index:35;pointer-events:none;background:rgba(2,6,23,.82);color:#e2e8f0;padding:8px 11px;border:1px solid #475569;border-radius:8px;font:12px/1.45 monospace;white-space:pre;display:none';
    container.appendChild(stats);
    let statsEnabled = false;
    let fpsFrames = 0;
    let fpsClock = performance.now();
    const applyGraphicsProfile = () => {
      const profile = graphicsProfiles[currentGraphicsProfile];
      renderer.setPixelRatio(profile.ratio);
      postProcessing.setPixelRatio(profile.ratio);
      sunLight.shadow.mapSize.set(profile.shadow, profile.shadow);
      sunLight.shadow.map?.dispose();
      sunLight.shadow.map = null;
      sunLight.shadow.needsUpdate = true;
      stats.textContent = `Modo: ${profile.name}`;
    };

    // --- INPUT LISTENERS ---
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'F7' && !e.repeat) {
        e.preventDefault();
        currentGraphicsProfile = (currentGraphicsProfile + 1) % graphicsProfiles.length;
        applyGraphicsProfile();
        return;
      }
      if (e.code === 'F8' && !e.repeat) {
        e.preventDefault();
        statsEnabled = !statsEnabled;
        stats.style.display = statsEnabled ? 'block' : 'none';
        fpsClock = performance.now();
        fpsFrames = 0;
        return;
      }
      keysRef.current[e.code] = true;

      // Double-tap W detection for supersonic flight / super sprint
      if (e.code === 'KeyW' || e.code === 'ArrowUp') {
        const now = performance.now();
        if (now - lastWPressTimeRef.current < 280) {
          isDoubleTapWActiveRef.current = true;
        }
        lastWPressTimeRef.current = now;
      }

      // Space takeoff from ground with environmental dust impact
      if (e.code === 'Space' && !isFlyingRef.current) {
        isFlyingRef.current = true;
        velRef.current.y = 28;
        destruction.triggerImpact(
          new THREE.Vector3(posRef.current.x, 0.1, posRef.current.z),
          new THREE.Vector3(0, 1, 0),
          45.0
        );
      }

      // Toggle flight / ground mode with C or G
      if (e.code === 'KeyC' || e.code === 'KeyG') {
        isFlyingRef.current = !isFlyingRef.current;
        if (!isFlyingRef.current) {
          posRef.current.y = 1.0;
          velRef.current.y = 0;
        } else {
          velRef.current.y = 22;
        }
      }

      // KEY Q / TAB: TARGET LOCK-ON (AERIAL & GROUND)
      if (e.code === 'KeyQ' || e.code === 'Tab') {
        e.preventDefault();
        const aimDir = new THREE.Vector3(-Math.sin(rotYRef.current), 0, -Math.cos(rotYRef.current));
        combat.toggleLockOn(
          new THREE.Vector3(posRef.current.x, posRef.current.y, posRef.current.z),
          aimDir
        );
      }

      // KEY F: GRAB & THROW VEHICLES / ENEMIES + GROUND SLAM
      if (e.code === 'KeyF') {
        const playerVec = new THREE.Vector3(posRef.current.x, posRef.current.y, posRef.current.z);
        const aimDir = new THREE.Vector3(
          -Math.sin(rotYRef.current),
          -cameraPitchRef.current * 0.5,
          -Math.cos(rotYRef.current)
        ).normalize();

        if (combat.isHolding) {
          combat.throwHeldObject(playerVec, aimDir);
          cameraShakeTimerRef.current = 0.35;
          cameraShakeIntensityRef.current = 1.5;
        } else {
          const grabbed = combat.attemptGrab(playerVec);
          if (!grabbed) {
            audioService.playGroundSlam();
            superman.triggerGroundSlamShockwave();
            destruction.triggerImpact(
              new THREE.Vector3(posRef.current.x, 0.1, posRef.current.z),
              new THREE.Vector3(0, 1, 0),
              75.0
            );
            if (crimeRef.current) {
              const hits = crimeRef.current.handleGroundSlamHit(posRef.current.x, posRef.current.z);
              if (hits > 0) onMissionCompleted(hits * 10);
            }
          }
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.code] = false;
      if (e.code === 'KeyW' || e.code === 'ArrowUp') {
        isDoubleTapWActiveRef.current = false;
      }
    };

    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 2) {
        // Hold Right Mouse Button = Supersonic Mach Flight / Super Sprint
        isRightMouseDownRef.current = true;
        e.preventDefault();
      } else if (e.button === 0) {
        // Left Mouse Button
        isMouseDownRef.current = true;
        mousePosRef.current = { x: e.clientX, y: e.clientY };

        const playerVec = new THREE.Vector3(posRef.current.x, posRef.current.y, posRef.current.z);
        const aimDir = new THREE.Vector3(
          -Math.sin(rotYRef.current),
          -cameraPitchRef.current * 0.5,
          -Math.cos(rotYRef.current)
        ).normalize();

        if (combat.isHolding) {
          combat.throwHeldObject(playerVec, aimDir);
          cameraShakeTimerRef.current = 0.35;
          cameraShakeIntensityRef.current = 1.5;
          return;
        }

        const forward = new THREE.Vector3(-Math.sin(rotYRef.current), 0, -Math.cos(rotYRef.current));
        const attackRes = combat.executeAttack(playerVec, forward, isFlyingRef.current);
        superman.triggerPunch(attackRes.comboStep);

        if (crimeRef.current) {
          const punchRes = crimeRef.current.handlePunchHit(
            posRef.current.x,
            posRef.current.y,
            posRef.current.z,
            rotYRef.current,
            attackRes.comboStep
          );
          if (punchRes.hits > 0 || punchRes.propsHit > 0 || punchRes.iceShattered > 0 || attackRes.hitTarget) {
            cameraShakeTimerRef.current = punchRes.iceShattered > 0 || attackRes.comboStep === 3 ? 0.36 : 0.22;
            cameraShakeIntensityRef.current = punchRes.iceShattered > 0 || attackRes.comboStep === 3 ? 1.5 : 0.95;
            if (punchRes.hits > 0 || attackRes.hitTarget) {
              onMissionCompleted(attackRes.comboStep === 3 ? 35 : 15);
            }
            if (punchRes.iceShattered > 0) {
              onMissionCompleted(punchRes.iceShattered * 25);
            }
          }
          if (punchRes.missionCompleted) {
            onMissionCompleted(30);
          }
        }
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      if (isMouseDownRef.current) {
        const dx = e.clientX - mousePosRef.current.x;
        const dy = e.clientY - mousePosRef.current.y;
        mousePosRef.current = { x: e.clientX, y: e.clientY };

        // Moving mouse left/right rotates Superman's heading directly
        rotYRef.current -= dx * 0.005;

        // Moving mouse up/down adjusts the downward-facing pitch angle (bounded so it never looks into the sky)
        cameraPitchRef.current = Math.max(-0.35, Math.min(0.35, cameraPitchRef.current + dy * 0.003));
      }
    };

    const onWheel = (e: WheelEvent) => {
      if (isFlyingRef.current) {
        // Mouse wheel scroll up ascends, scroll down descends
        velRef.current.y += e.deltaY < 0 ? 16 : -16;
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 2) {
        isRightMouseDownRef.current = false;
      } else if (e.button === 0) {
        isMouseDownRef.current = false;
      }
    };

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const onResize = () => {
      if (!renderer || !camera) return;
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      postProcessing.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('resize', onResize);

    // Cache immutable colors instead of allocating two Color instances each frame.
    const groundSkyColor = new THREE.Color(0x38bdf8);
    const spaceSkyColor = new THREE.Color(0x010409);

    // --- MAIN GAME LOOP ---
    let lastTime = performance.now();

    const animate = (time: number) => {
      animFrameIdRef.current = requestAnimationFrame(animate);
      const delta = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;

      // Spin Daily Planet Globe
      if (cityData.dailyPlanetGlobe) {
        cityData.dailyPlanetGlobe.rotation.y += delta * 0.4;
      }

      // Input parsing: Supersonic is triggered by Right Click hold OR Double Tap W OR externalSupersonic
      const isSupersonicTriggered =
        isRightMouseDownRef.current ||
        isDoubleTapWActiveRef.current ||
        Boolean(externalSupersonic);
      const isSupersonicNow = isSupersonicTriggered && isFlyingRef.current;
      isSupersonicRef.current = isSupersonicNow;

      // Descend / Dive: SHIFT key is FIXED for descending!
      const isShiftDown = Boolean(
        keysRef.current['ShiftLeft'] ||
        keysRef.current['ShiftRight'] ||
        externalDescend
      );

      let moveForward = 0;
      let moveTurn = 0;
      let moveUp = 0;

      // W / Up: Forward thrust
      if (keysRef.current['KeyW'] || keysRef.current['ArrowUp']) moveForward += 1;
      // S / Down: Reverse / Air brake
      if (keysRef.current['KeyS'] || keysRef.current['ArrowDown']) moveForward -= 0.6;
      // A / Left: Turn / Steer Left
      if (keysRef.current['KeyA'] || keysRef.current['ArrowLeft']) moveTurn += 1;
      // D / Right: Turn / Steer Right
      if (keysRef.current['KeyD'] || keysRef.current['ArrowRight']) moveTurn -= 1;

      // Ascend: Space bar
      if (keysRef.current['Space'] || externalAscend) moveUp += 1;

      // Descend: SHIFT (fixed) or C / Ctrl / Q / Z / PageDown
      if (
        isShiftDown ||
        keysRef.current['KeyC'] ||
        keysRef.current['ControlLeft'] ||
        keysRef.current['ControlRight'] ||
        keysRef.current['KeyQ'] ||
        keysRef.current['KeyZ'] ||
        keysRef.current['PageDown']
      ) {
        moveUp -= 1;
      }

      // Merge mobile virtual joystick input
      if (externalMove.dx !== 0 || externalMove.dz !== 0) {
        moveTurn -= externalMove.dx * 1.5;
        moveForward -= externalMove.dz;
      }

      // Turn Superman smoothly with A/D or touch
      if (moveTurn !== 0) {
        rotYRef.current += moveTurn * delta * 2.8;
      }

      // Banking roll when turning in flight
      pitchRef.current = THREE.MathUtils.lerp(pitchRef.current, moveTurn * 0.45, delta * 8.0);

      // Dive state: actively descending while flying (Shift or moveUp < 0)
      const isDiving = isFlyingRef.current && (isShiftDown || moveUp < 0);
      isDivingRef.current = isDiving;

      // Forward direction based on Superman's current heading
      const forwardDirX = -Math.sin(rotYRef.current);
      const forwardDirZ = -Math.cos(rotYRef.current);

      // Speed calculations: True Super Speed & Cosmic Warp in Deep Space!
      const altitude = posRef.current.y;
      const isSpace = altitude > 650;
      const spaceSpeedFactor = isSpace
        ? Math.min(14.0, 1.0 + Math.pow((altitude - 650) / 1000, 1.35))
        : 1.0;

      const speedMultiplier = isSupersonicRef.current
        ? (isFlyingRef.current ? 400 * spaceSpeedFactor : 92)
        : isFlyingRef.current
        ? 95 * (isSpace ? Math.min(4.5, 1.0 + (altitude - 650) / 1800) : 1.0)
        : 22;

      // INSTANT SUPERSONIC IMPULSE TRIGGER:
      // No more slow progressive acceleration! Instant Mach thrust with immediate sonic boom
      if (isSupersonicNow && !wasSupersonicLastFrameRef.current) {
        superman.triggerInstantSonicBoom();
        audioService.playInstantSonicBoom();
        cameraShakeTimerRef.current = 0.42;
        cameraShakeIntensityRef.current = 1.8;
        camera.fov = 92;
        camera.updateProjectionMatrix();

        // Immediately explode into Mach speed!
        velRef.current.x = forwardDirX * speedMultiplier;
        velRef.current.z = forwardDirZ * speedMultiplier;
      }
      wasSupersonicLastFrameRef.current = isSupersonicNow;

      // Acrobatic Barrel Roll Maneuver during flight when pressing A/D while supersonic or fast
      if (isFlyingRef.current && (isSupersonicNow || Math.hypot(velRef.current.x, velRef.current.z) > 40)) {
        if (keysRef.current['KeyA'] || keysRef.current['ArrowLeft']) {
          barrelRollAngleRef.current -= delta * Math.PI * 5.0;
        } else if (keysRef.current['KeyD'] || keysRef.current['ArrowRight']) {
          barrelRollAngleRef.current += delta * Math.PI * 5.0;
        } else {
          barrelRollAngleRef.current = THREE.MathUtils.lerp(barrelRollAngleRef.current, 0, delta * 12);
        }
      } else {
        barrelRollAngleRef.current = THREE.MathUtils.lerp(barrelRollAngleRef.current, 0, delta * 8);
      }

      const effectiveForward = isDiving ? Math.max(0.85, moveForward) : moveForward;
      const targetSpeed = effectiveForward * speedMultiplier;

      const targetVx = forwardDirX * targetSpeed;
      const targetVz = forwardDirZ * targetSpeed;

      // Supersonic reaches target velocity instantaneously (delta * 32) instead of slow progressive ramp
      const accelRate = isSupersonicRef.current ? delta * 32.0 : delta * 6.5;
      velRef.current.x = THREE.MathUtils.lerp(velRef.current.x, targetVx, accelRate);
      velRef.current.z = THREE.MathUtils.lerp(velRef.current.z, targetVz, accelRate);

      // Vertical flight and descending dynamics
      if (isFlyingRef.current) {
        if (moveUp > 0) {
          // Ascend with Space - rocket-grade acceleration scaling into cosmic space
          const highAltBoost = posRef.current.y > 650
            ? Math.min(12.0, 2.0 + (posRef.current.y - 650) / 1200)
            : posRef.current.y > 250 ? 1.85 : 1.0;
          const targetVy = (isSupersonicRef.current ? 220 : 90) * highAltBoost;
          velRef.current.y = THREE.MathUtils.lerp(velRef.current.y, targetVy, delta * 7.5);
        } else if (moveUp < 0) {
          // DIVE DOWNWARD WITH SHIFT - Steep full dive acceleration toward the streets
          const targetVy = isSupersonicRef.current ? -320 : -160;
          velRef.current.y = THREE.MathUtils.lerp(velRef.current.y, targetVy, delta * 9.5);
        } else {
          // Level cruise
          velRef.current.y = THREE.MathUtils.lerp(velRef.current.y, 0, delta * 6.0);
        }
      } else {
        if (moveUp > 0) {
          isFlyingRef.current = true;
          velRef.current.y = 35;
        } else {
          velRef.current.y = THREE.MathUtils.lerp(velRef.current.y, -30, delta * 5); // Gravity
        }
      }

      // Update position
      posRef.current.x += velRef.current.x * delta;
      posRef.current.y += velRef.current.y * delta;
      posRef.current.z += velRef.current.z * delta;

      // World boundary constraints: Unlocked infinite cosmos in outer space, city bounds only near ground!
      if (posRef.current.y <= 650) {
        posRef.current.x = Math.max(-1100, Math.min(1100, posRef.current.x));
        posRef.current.z = Math.max(-1100, Math.min(1100, posRef.current.z));
      }

      // Ground limit and Hero Landing impact
      if (posRef.current.y <= 1.05) {
        if (velRef.current.y < -18 && !isHeroLandingRef.current) {
          // HERO LANDING IMPACT!
          isHeroLandingRef.current = true;
          heroLandingTimerRef.current = 0.55;
          isFlyingRef.current = false;

          // Ground shockwave, crater, debris and impact sound
          superman.triggerGroundSlamShockwave();
          audioService.playGroundSlam();
          destruction.triggerImpact(
            new THREE.Vector3(posRef.current.x, 0.1, posRef.current.z),
            new THREE.Vector3(0, 1, 0),
            Math.min(125, Math.abs(velRef.current.y) * 3.8)
          );

          // Camera shake proportional to downward velocity
          cameraShakeTimerRef.current = 0.38;
          cameraShakeIntensityRef.current = Math.min(2.5, Math.abs(velRef.current.y) * 0.05);

          // Knock back or stun nearby thugs
          if (crimeRef.current) {
            const hits = crimeRef.current.handleGroundSlamHit(posRef.current.x, posRef.current.z, 20);
            if (hits > 0) onMissionCompleted(hits * 10);
          }
        }
        posRef.current.y = 1.0;
        velRef.current.y = 0;
      }

      // Update hero landing and camera shake timers
      if (heroLandingTimerRef.current > 0) {
        heroLandingTimerRef.current -= delta;
        if (heroLandingTimerRef.current <= 0) {
          isHeroLandingRef.current = false;
        }
      }

      if (cameraShakeTimerRef.current > 0) {
        cameraShakeTimerRef.current -= delta;
      }

      // Atmospheric & Outer Space Sky Transition
      const alt = posRef.current.y;
      const spaceFactor = THREE.MathUtils.clamp((alt - 180) / 550, 0, 1);
      (scene.background as THREE.Color).lerpColors(groundSkyColor, spaceSkyColor, spaceFactor);

      if (scene.fog) {
        (scene.fog as THREE.FogExp2).density = THREE.MathUtils.lerp(0.0018, 0.000008, spaceFactor);
      }

      starMat.opacity = spaceFactor * 0.95;
      atmoGlowMat.opacity = spaceFactor * 0.75;
      corona1Mat.opacity = 0.5 + spaceFactor * 0.45;

      // Celestial Bodies subtle cosmic orbital rotations
      earthSphere.rotation.y += delta * 0.002;
      moonGroup.rotation.y += delta * 0.006;
      marsGroup.rotation.y += delta * 0.005;
      saturnGroup.rotation.y += delta * 0.007;

      // Building Collision detection & Spider-Man Vertical Wall Running / Rooftop Catapult Vault!
      if (posRef.current.y < 280) {
        const col = cityData.checkCollision(posRef.current.x, posRef.current.y, posRef.current.z, 2.0);
        if (col.hit) {
          posRef.current.x += col.pushX * 1.05;
          posRef.current.z += col.pushZ * 1.05;

          const bHeight = col.buildingHeight || 65;
          // When moving toward facade with forward intent:
          const isPushingAgainstWall =
            (moveForward > 0 || Math.hypot(velRef.current.x, velRef.current.z) > 8) &&
            posRef.current.y < bHeight - 1.0;

          if (isPushingAgainstWall) {
            // SPIDER-MAN VERTICAL WALL RUN MODE:
            // Sprints straight UP the building facade at high superhero speed!
            isWallRunningRef.current = true;
            isFlyingRef.current = false;

            velRef.current.y = 52;
            posRef.current.y += 52 * delta;

            // Rhythmic wall running strides audio
            wallRunStrideTimerRef.current += delta;
            if (wallRunStrideTimerRef.current > 0.12) {
              wallRunStrideTimerRef.current = 0;
              audioService.playWallRunStride();
            }

            // CINEMATIC ROOFTOP CATAPULT VAULT:
            // When reaching the roof lip, catapult into the sky with an acrobatic superhero leap!
            if (posRef.current.y >= bHeight - 2.0) {
              posRef.current.y = bHeight + 2.5;
              velRef.current.y = 44; // Rocket spring into the clouds
              velRef.current.x = forwardDirX * 52; // Forward vault leap
              velRef.current.z = forwardDirZ * 52;
              isFlyingRef.current = true;
              isWallRunningRef.current = false;
              cameraShakeTimerRef.current = 0.28;
              cameraShakeIntensityRef.current = 1.3;
              onMissionCompleted(15); // Style bonus for acrobatic parkour vault!
            }
          } else {
            isWallRunningRef.current = false;
            // Wall deflection: project velocity along the wall surface to glide smoothly
            const dot = velRef.current.x * col.normalX + velRef.current.z * col.normalZ;
            if (dot < 0) {
              const impactSpeed = Math.abs(dot);
              if (impactSpeed > 22 && destructionRef.current) {
                destructionRef.current.triggerImpact(
                  new THREE.Vector3(posRef.current.x, posRef.current.y, posRef.current.z),
                  new THREE.Vector3(col.normalX, 0, col.normalZ),
                  impactSpeed * 2.2,
                  true
                );
                cameraShakeTimerRef.current = 0.28;
                cameraShakeIntensityRef.current = 1.2;
              }
              velRef.current.x -= dot * col.normalX;
              velRef.current.z -= dot * col.normalZ;
              velRef.current.x *= 0.92;
              velRef.current.z *= 0.92;
            }
          }
        } else {
          isWallRunningRef.current = false;
        }
      } else {
        isWallRunningRef.current = false;
      }

      // Calculate velocity metrics
      const horizontalSpeed = Math.hypot(velRef.current.x, velRef.current.z);
      const totalSpeed = Math.hypot(horizontalSpeed, velRef.current.y);
      const speedKmh = totalSpeed * 3.6;
      // Real Mach representation: Mach 1 is 1235 km/h. At supersonic speeds, registers Mach 1.2 to 5.5+
      const mach = isSupersonicRef.current
        ? Math.max(1.2, speedKmh / 320)
        : speedKmh > 320
        ? speedKmh / 320
        : 0;

      // Wind sound
      audioService.updateWindSound(totalSpeed / 160, isSupersonicRef.current);

      // Solar energy recharge under yellow sunlight
      const isSolarCharging = posRef.current.y > 550;
      if (isSolarCharging) {
        // Direct, unfiltered solar radiation in upper thermosphere / orbital space!
        solarEnergyRef.current = Math.min(100, solarEnergyRef.current + delta * 28);
        healthRef.current = Math.min(100, healthRef.current + delta * 15);
      } else if (posRef.current.y > 80) {
        solarEnergyRef.current = Math.min(100, solarEnergyRef.current + delta * 1.5);
      }

      // Sonic boom trigger when breaking Mach
      if (isSupersonicRef.current && speedKmh > 400 && Math.random() < 0.015) {
        audioService.playSonicBoom();
      }

      // Power triggers
      const isFiringHeat =
        Boolean(keysRef.current['KeyR']) ||
        Boolean(keysRef.current['Digit1']) ||
        externalPowerTrigger === 'heat-vision' ||
        (activePower === 'heat-vision' && Boolean(keysRef.current['KeyR']));

      const isFiringFreeze =
        Boolean(keysRef.current['KeyE']) ||
        Boolean(keysRef.current['Digit2']) ||
        externalPowerTrigger === 'freeze-breath' ||
        (activePower === 'freeze-breath' && Boolean(keysRef.current['KeyE']));

      if (isFiringHeat) {
        audioService.startHeatVision();
        solarEnergyRef.current = Math.max(0, solarEnergyRef.current - delta * 4);
      } else {
        audioService.stopHeatVision();
      }

      if (isFiringFreeze) {
        audioService.startFreezeBreath();
        solarEnergyRef.current = Math.max(0, solarEnergyRef.current - delta * 3);
      } else {
        audioService.stopFreezeBreath();
      }

      // Advance physics simulation, destruction systems & combat trajectory
      if (physicsRef.current) physicsRef.current.step(delta);
      if (destructionRef.current) destructionRef.current.update(delta);
      const aimDir = new THREE.Vector3(
        -Math.sin(rotYRef.current),
        -cameraPitchRef.current * 0.5,
        -Math.cos(rotYRef.current)
      ).normalize();
      if (combatRef.current) {
        combatRef.current.update(
          delta,
          new THREE.Vector3(posRef.current.x, posRef.current.y, posRef.current.z),
          rotYRef.current,
          aimDir
        );
      }

      // Update Superman mesh pose and position with locomotion, dive, and landing states
      superman.group.position.set(posRef.current.x, posRef.current.y, posRef.current.z);
      superman.group.rotation.y = rotYRef.current + Math.PI;
      superman.group.rotation.z = isFlyingRef.current ? pitchRef.current : 0;
      superman.updatePose(
        isFlyingRef.current,
        isSupersonicRef.current,
        totalSpeed,
        delta,
        isFiringHeat,
        isFiringFreeze,
        isHeroLandingRef.current,
        heroLandingTimerRef.current,
        isDiving,
        isSolarCharging,
        isWallRunningRef.current,
        barrelRollAngleRef.current,
        Boolean(combatRef.current?.isHolding)
      );

      // Update Ground Systems (Traffic & Pedestrians) with Orbit Performance Culling
      const isHighOrbit = posRef.current.y > 750;
      if (!isHighOrbit) {
        traffic.update(delta, posRef.current.x, posRef.current.z, posRef.current.y);
        npcs.update(posRef.current.x, posRef.current.y, posRef.current.z, delta);
      }

      // Freeze nearby traffic cars if using Freeze Breath
      if (isFiringFreeze && !isHighOrbit) {
        const nearCar = traffic.getNearestCar(posRef.current.x, posRef.current.y, posRef.current.z, 22);
        if (nearCar) {
          traffic.freezeCar(nearCar.id);
        }
      }

      // Update Crime Events
      const crimeRes = crime.update(
        delta,
        posRef.current.x,
        posRef.current.y,
        posRef.current.z,
        isFiringHeat,
        isFiringFreeze,
        activePower
      );

      if (crimeRes.missionCompleted) {
        onMissionCompleted(crime.getActiveMission().rewardHope);
      }

      // Camera Framing: AAA Cinematic Third-Person Framing (Over-the-Shoulder & Anti-Occlusion)
      const isCosmos = posRef.current.y > 800;
      const camDist = isCosmos
        ? 19.5
        : isSupersonicRef.current
        ? 16.5
        : isFlyingRef.current
        ? 11.2
        : 5.4;
      const camElevation = isCosmos
        ? 6.8
        : isSupersonicRef.current
        ? 5.8
        : isFlyingRef.current
        ? 4.6
        : 2.2;

      // Over-the-shoulder subtle lateral camera offset for cinematic AAA presence
      const shoulderOffset = (isFlyingRef.current || isCosmos) ? 0.0 : 0.42;
      const rightX = Math.cos(rotYRef.current) * shoulderOffset;
      const rightZ = -Math.sin(rotYRef.current) * shoulderOffset;

      // Position camera directly behind Superman's facing angle with shoulder offset
      let targetCamX = posRef.current.x + Math.sin(rotYRef.current) * camDist + rightX;
      let targetCamZ = posRef.current.z + Math.cos(rotYRef.current) * camDist + rightZ;
      let targetCamY = posRef.current.y + camElevation;

      // Building Occlusion Avoidance: prevent skyscrapers from blocking camera line-of-sight
      if (cityData.checkCollision && !isCosmos) {
        const camCol = cityData.checkCollision(targetCamX, targetCamY, targetCamZ, 1.2);
        if (camCol.hit) {
          targetCamX = posRef.current.x + Math.sin(rotYRef.current) * 2.8 + rightX * 0.5;
          targetCamZ = posRef.current.z + Math.cos(rotYRef.current) * 2.8 + rightZ * 0.5;
          targetCamY = posRef.current.y + 1.9;
        }
      }

      // Look Target: Locked Target (if lock-on active) or Ahead of Superman
      const lookAheadDist = isSupersonicRef.current ? 22.0 : 15.0;
      let lookTargetX = posRef.current.x - Math.sin(rotYRef.current) * lookAheadDist;
      let lookTargetZ = posRef.current.z - Math.cos(rotYRef.current) * lookAheadDist;
      let lookTargetY = posRef.current.y + (isDiving ? -9.5 : -0.5) - cameraPitchRef.current * 5.5;

      if (combatRef.current?.isLockOnActive && combatRef.current?.lockedTarget) {
        lookTargetX = combatRef.current.lockedTarget.x;
        lookTargetY = combatRef.current.lockedTarget.y;
        lookTargetZ = combatRef.current.lockedTarget.z;
      }

      // Camera shake during supersonic sonic boom or hero landing impact
      if (cameraShakeTimerRef.current > 0) {
        const shake = cameraShakeIntensityRef.current * (cameraShakeTimerRef.current / 0.35);
        targetCamX += (Math.random() - 0.5) * shake;
        targetCamY += (Math.random() - 0.5) * shake;
        targetCamZ += (Math.random() - 0.5) * shake;
      }

      // Pre-allocated vectors for smooth GC-free interpolation
      tempCamTargetRef.current.set(targetCamX, targetCamY, targetCamZ);
      tempLookTargetRef.current.set(lookTargetX, lookTargetY, lookTargetZ);
      camera.position.lerp(tempCamTargetRef.current, delta * 10.0);
      currentLookAtRef.current.lerp(tempLookTargetRef.current, delta * 12.0);
      camera.lookAt(currentLookAtRef.current);

      // Dynamic FOV for hypersonic tunnel sensation
      const targetFOV = isSupersonicRef.current ? 86 : isFlyingRef.current ? 68 : 60;
      const newFov = THREE.MathUtils.lerp(camera.fov, targetFOV, delta * 5);
      if (Math.abs(newFov - camera.fov) > 0.002) {
        camera.fov = newFov;
        camera.updateProjectionMatrix();
      }

      // Dynamic LOD & Skyscraper Culling based on camera position
      // LOD checks need not run 60 times per second for static buildings.
      if (cityData.updateLOD && throttleCounterRef.current % 6 === 0) {
        cityData.updateLOD(camera.position);
      }

      // Bloom is enabled only for heat vision; motion blur only for supersonic flight.
      postProcessing.update(delta, isFiringHeat, isSupersonicRef.current, mach);
      postProcessing.render();

      // Built-in performance diagnostics, refreshed twice per second.
      if (statsEnabled) {
        fpsFrames++;
        if (time - fpsClock >= 500) {
          const fps = Math.round((fpsFrames * 1000) / (time - fpsClock));
          const info = renderer.info.render;
          stats.textContent = `Modo: ${graphicsProfiles[currentGraphicsProfile].name} | F7 cambiar | F8 ocultar\nFPS: ${fps} | Draw calls: ${info.calls} | Triángulos: ${info.triangles.toLocaleString('es-CO')}\nObjetos físicos: ${physics.getDynamicObjectsCount()}`;
          fpsFrames = 0;
          fpsClock = time;
        }
      }

      // React HUD/minimap at ~10 Hz; 3D physics and camera still run every frame.
      throttleCounterRef.current++;
      if (throttleCounterRef.current % 6 === 0) {
        onUpdateState({
          playerX: posRef.current.x,
          playerZ: posRef.current.z,
          altMeters: posRef.current.y,
          speedKmh,
          mach,
          isFlying: isFlyingRef.current,
          isSupersonic: isSupersonicRef.current,
          solarEnergy: solarEnergyRef.current,
          health: healthRef.current,
          buildings: cityData.buildings,
          trafficCars: traffic.cars,
          activeMission: crime.getActiveMission(),
          currentMissionIndex: crime.activeMissionIndex,
          allMissions: crime.missions,
          isHoldingObject: combatRef.current?.isHolding,
          hasLockedTarget: combatRef.current?.isLockOnActive,
          comboStep: combatRef.current?.getComboStep(),
        });
      }
    };

    animFrameIdRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', onResize);
      audioService.stopHeatVision();
      audioService.stopFreezeBreath();
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      npcs.dispose();
      stats.remove();
      postProcessing.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`w-full h-full absolute inset-0 cursor-grab active:cursor-grabbing ${
        xrayActive ? 'filter hue-rotate-180 invert brightness-125 contrast-125' : ''
      }`}
    />
  );
};
