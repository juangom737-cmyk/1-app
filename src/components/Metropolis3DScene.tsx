import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import {
  PowerType,
  CityBuilding,
  TrafficCar,
  Mission,
  EnemyEntity,
  LockedTargetInfo,
  GraphicQualityProfile,
  PerformanceMetrics,
  TimeOfDayMode,
} from '../types/game';
import { buildBogotaCity, CityData } from '../game/CityBuilder';
import { TrafficSystem } from '../game/TrafficSystem';
import { createSupermanCharacter, SupermanMeshController } from '../game/SupermanCharacter';
import { CrimeManager } from '../game/CrimeManager';
import { NPCSystem } from '../game/NPCSystem';
import { audioService } from '../services/AudioService';
import { setupPostProcessing, PostProcessingController } from '../game/PostProcessingEffects';
import { PhysicsEngine } from '../game/PhysicsEngine';
import { DestructionSystem } from '../game/DestructionSystem';
import { CombatSystem } from '../game/CombatSystem';

export interface SceneStateSnapshot {
  playerX: number;
  playerZ: number;
  playerRotationY: number;
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
  activeEnemies: EnemyEntity[];
  isHoldingObject?: boolean;
  hasLockedTarget?: boolean;
  lockedTargetInfo?: LockedTargetInfo | null;
  comboStep?: number;
  citizenDialogue?: string | null;
  performanceMetrics?: PerformanceMetrics;
}

interface Metropolis3DSceneProps {
  onUpdateState: (state: SceneStateSnapshot) => void;
  activePower: PowerType | null;
  xrayActive: boolean;
  timeOfDay: TimeOfDayMode;
  graphicProfile: GraphicQualityProfile;
  onSelectGraphicProfile: (profile: GraphicQualityProfile) => void;
  onTogglePerfHud: () => void;
  onCycleTimeOfDay: () => void;
  onMissionCompleted: (hopeGain: number) => void;
  externalMove: { dx: number; dz: number };
  externalAscend: boolean;
  externalDescend: boolean;
  externalSupersonic: boolean;
  externalPowerTrigger: PowerType | null;
  toggleFlightTrigger: number;
  externalPunchTrigger: number;
  externalGrabTrigger: number;
  externalLockOnTrigger: number;
  missionIndexToSwitch: number | null;
  onMissionSwitched: () => void;
}

export const Metropolis3DScene: React.FC<Metropolis3DSceneProps> = ({
  onUpdateState,
  activePower,
  xrayActive,
  timeOfDay,
  graphicProfile,
  onSelectGraphicProfile,
  onTogglePerfHud,
  onCycleTimeOfDay,
  onMissionCompleted,
  externalMove,
  externalAscend,
  externalDescend,
  externalSupersonic,
  externalPowerTrigger,
  toggleFlightTrigger,
  externalPunchTrigger,
  externalGrabTrigger,
  externalLockOnTrigger,
  missionIndexToSwitch,
  onMissionSwitched,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // References for scene lifecycle
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const postProcessingRef = useRef<PostProcessingController | null>(null);
  const sunLightRef = useRef<THREE.DirectionalLight | null>(null);
  const hemiLightRef = useRef<THREE.HemisphereLight | null>(null);
  const rimLightRef = useRef<THREE.DirectionalLight | null>(null);
  const animFrameIdRef = useRef<number | null>(null);

  const cityDataRef = useRef<CityData | null>(null);
  const trafficRef = useRef<TrafficSystem | null>(null);
  const supermanRef = useRef<SupermanMeshController | null>(null);
  const crimeRef = useRef<CrimeManager | null>(null);
  const npcRef = useRef<NPCSystem | null>(null);
  const physicsRef = useRef<PhysicsEngine | null>(null);
  const destructionRef = useRef<DestructionSystem | null>(null);
  const combatRef = useRef<CombatSystem | null>(null);

  // Player physics state
  const posRef = useRef({ x: 0, y: 22, z: 110 }); // Begin above Plaza de Bolívar
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
  const currentLookAtRef = useRef(new THREE.Vector3(0, 22, 110));
  const mousePosRef = useRef({ x: 0, y: 0 });
  const cameraPitchRef = useRef(0.15);
  const isHeroLandingRef = useRef(false);
  const heroLandingTimerRef = useRef(0);
  const cameraShakeTimerRef = useRef(0);
  const cameraShakeIntensityRef = useRef(0);
  const wallImpactCooldownRef = useRef(0);
  const wasSupersonicLastFrameRef = useRef(false);
  const isWallRunningRef = useRef(false);
  const wallRunStrideTimerRef = useRef(0);
  const barrelRollAngleRef = useRef(0);

  // Live reactive refs for props accessed inside 60fps loop
  const activePowerRef = useRef(activePower);
  const externalMoveRef = useRef(externalMove);
  const externalAscendRef = useRef(externalAscend);
  const externalDescendRef = useRef(externalDescend);
  const externalSupersonicRef = useRef(externalSupersonic);
  const externalPowerTriggerRef = useRef(externalPowerTrigger);
  const graphicProfileRef = useRef<GraphicQualityProfile>(graphicProfile);
  const timeOfDayRef = useRef<TimeOfDayMode>(timeOfDay);
  const groundSkyColorRef = useRef(new THREE.Color(0x8fc6d7));

  useEffect(() => {
    activePowerRef.current = activePower;
  }, [activePower]);
  useEffect(() => {
    externalMoveRef.current = externalMove;
  }, [externalMove]);
  useEffect(() => {
    externalAscendRef.current = externalAscend;
  }, [externalAscend]);
  useEffect(() => {
    externalDescendRef.current = externalDescend;
  }, [externalDescend]);
  useEffect(() => {
    externalSupersonicRef.current = externalSupersonic;
  }, [externalSupersonic]);
  useEffect(() => {
    externalPowerTriggerRef.current = externalPowerTrigger;
  }, [externalPowerTrigger]);

  // Performance optimization pre-allocated vectors to prevent GC allocations in 60fps loop
  const tempCamTargetRef = useRef(new THREE.Vector3());
  const tempLookTargetRef = useRef(new THREE.Vector3());
  const throttleCounterRef = useRef(0);
  const xrayActiveRef = useRef(xrayActive);

  // Helper: Perform Punch / Attack
  const performPunchAction = () => {
    const combat = combatRef.current;
    const superman = supermanRef.current;
    const crime = crimeRef.current;
    if (!combat || !superman || !crime) return;

    const playerVec = new THREE.Vector3(posRef.current.x, posRef.current.y, posRef.current.z);
    const aimDir = new THREE.Vector3(
      -Math.sin(rotYRef.current),
      -cameraPitchRef.current * 0.5,
      -Math.cos(rotYRef.current)
    ).normalize();

    if (combat.isHolding) {
      combat.throwHeldObject(playerVec, aimDir, onMissionCompleted);
      cameraShakeTimerRef.current = 0.35;
      cameraShakeIntensityRef.current = 1.5;
      return;
    }

    const forward = new THREE.Vector3(-Math.sin(rotYRef.current), 0, -Math.cos(rotYRef.current));
    const attackRes = combat.executeAttack(playerVec, forward, isFlyingRef.current);
    superman.triggerPunch(attackRes.comboStep);

    // Apply Air Dash Strike impulse if locked onto a target
    if (attackRes.targetRotY !== undefined) {
      rotYRef.current = attackRes.targetRotY;
    }
    if (attackRes.dashVelocity) {
      velRef.current.x = attackRes.dashVelocity.x;
      velRef.current.y = attackRes.dashVelocity.y;
      velRef.current.z = attackRes.dashVelocity.z;
    }

    const punchRes = crime.handlePunchHit(
      posRef.current.x,
      posRef.current.y,
      posRef.current.z,
      rotYRef.current,
      attackRes.comboStep
    );
    if (
      punchRes.hits > 0 ||
      punchRes.propsHit > 0 ||
      punchRes.iceShattered > 0 ||
      attackRes.hitTarget
    ) {
      cameraShakeTimerRef.current =
        punchRes.iceShattered > 0 || attackRes.comboStep === 3 ? 0.36 : 0.22;
      cameraShakeIntensityRef.current =
        punchRes.iceShattered > 0 || attackRes.comboStep === 3 ? 1.5 : 0.95;
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
  };

  // Helper: Perform Grab / Throw / Ground Slam
  const performGrabOrSlamAction = () => {
    const combat = combatRef.current;
    const superman = supermanRef.current;
    const destruction = destructionRef.current;
    const crime = crimeRef.current;
    const traffic = trafficRef.current;
    if (!combat || !superman || !destruction) return;

    const playerVec = new THREE.Vector3(posRef.current.x, posRef.current.y, posRef.current.z);
    const aimDir = new THREE.Vector3(
      -Math.sin(rotYRef.current),
      -cameraPitchRef.current * 0.5,
      -Math.cos(rotYRef.current)
    ).normalize();

    if (combat.isHolding) {
      combat.throwHeldObject(playerVec, aimDir, onMissionCompleted);
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
        if (traffic) {
          traffic.triggerTrafficPanic(posRef.current.x, posRef.current.z, 32);
        }
        if (crime) {
          const hits = crime.handleGroundSlamHit(posRef.current.x, posRef.current.z);
          if (hits > 0) onMissionCompleted(hits * 10);
        }
      }
    }
  };

  // Helper: Toggle Lock-On
  const performLockOnAction = () => {
    const combat = combatRef.current;
    if (!combat) return;
    const aimDir = new THREE.Vector3(
      -Math.sin(rotYRef.current),
      0,
      -Math.cos(rotYRef.current)
    );
    combat.toggleLockOn(
      new THREE.Vector3(posRef.current.x, posRef.current.y, posRef.current.z),
      aimDir
    );
  };

  // Toggle flight externally
  useEffect(() => {
    if (toggleFlightTrigger > 0) {
      isFlyingRef.current = !isFlyingRef.current;
      if (!isFlyingRef.current) {
        if (posRef.current.y <= 0.08) posRef.current.y = 0.0;
        velRef.current.y = 0;
      } else {
        velRef.current.y = 18;
      }
    }
  }, [toggleFlightTrigger]);

  // External Punch trigger
  useEffect(() => {
    if (externalPunchTrigger > 0) {
      performPunchAction();
    }
  }, [externalPunchTrigger]);

  // External Grab / Slam trigger
  useEffect(() => {
    if (externalGrabTrigger > 0) {
      performGrabOrSlamAction();
    }
  }, [externalGrabTrigger]);

  // External Lock-on trigger
  useEffect(() => {
    if (externalLockOnTrigger > 0) {
      performLockOnAction();
    }
  }, [externalLockOnTrigger]);

  // Mission switch externally
  useEffect(() => {
    if (missionIndexToSwitch !== null && crimeRef.current) {
      crimeRef.current.switchMission(missionIndexToSwitch);
      onMissionSwitched();
    }
  }, [missionIndexToSwitch, onMissionSwitched]);

  // Apply Graphics Profile changes
  useEffect(() => {
    graphicProfileRef.current = graphicProfile;
    const renderer = rendererRef.current;
    const postProcessing = postProcessingRef.current;
    const sunLight = sunLightRef.current;
    if (!renderer || !postProcessing || !sunLight) return;

    const profileSettings: Record<
      GraphicQualityProfile,
      { ratio: number; shadow: number }
    > = {
      'radeon-optimized': { ratio: 1.0, shadow: 1024 },
      'balanced-30': { ratio: 0.8, shadow: 512 },
      'ultra-fidelity': {
        ratio: Math.min(1.5, window.devicePixelRatio || 1.25),
        shadow: 2048,
      },
    };
    const cfg = profileSettings[graphicProfile];
    renderer.setPixelRatio(cfg.ratio);
    postProcessing.setPixelRatio(cfg.ratio);
    sunLight.shadow.mapSize.set(cfg.shadow, cfg.shadow);
    sunLight.shadow.map?.dispose();
    sunLight.shadow.map = null;
    sunLight.shadow.needsUpdate = true;
  }, [graphicProfile]);

  // Apply Time of Day lighting changes
  useEffect(() => {
    timeOfDayRef.current = timeOfDay;
    const sunLight = sunLightRef.current;
    const hemiLight = hemiLightRef.current;
    const rimLight = rimLightRef.current;
    const scene = sceneRef.current;
    const cityData = cityDataRef.current;
    if (!sunLight || !hemiLight || !rimLight || !scene) return;

    if (timeOfDay === 'cyber-night') {
      groundSkyColorRef.current.setHex(0x050b18);
      hemiLight.color.setHex(0x1e293b);
      hemiLight.groundColor.setHex(0x090d16);
      hemiLight.intensity = 0.65;
      sunLight.color.setHex(0x38bdf8);
      sunLight.intensity = 1.35;
      rimLight.color.setHex(0xa855f7);
      rimLight.intensity = 0.9;
      if (scene.fog) (scene.fog as THREE.FogExp2).color.setHex(0x0b1528);
    } else if (timeOfDay === 'daylight') {
      groundSkyColorRef.current.setHex(0x0ea5e9);
      hemiLight.color.setHex(0x7dd3fc);
      hemiLight.groundColor.setHex(0x334155);
      hemiLight.intensity = 1.35;
      sunLight.color.setHex(0xfffbeb);
      sunLight.intensity = 3.5;
      rimLight.color.setHex(0x38bdf8);
      rimLight.intensity = 0.65;
      if (scene.fog) (scene.fog as THREE.FogExp2).color.setHex(0xbae6fd);
    } else {
      // golden-hour
      groundSkyColorRef.current.setHex(0x8fc6d7);
      hemiLight.color.setHex(0x9bd3e2);
      hemiLight.groundColor.setHex(0x394d3f);
      hemiLight.intensity = 1.3;
      sunLight.color.setHex(0xffc080);
      sunLight.intensity = 3.0;
      rimLight.color.setHex(0xf4a65b);
      rimLight.intensity = 0.72;
      if (scene.fog) (scene.fog as THREE.FogExp2).color.setHex(0xb0cbd0);
    }
    scene.background = groundSkyColorRef.current.clone();
    if (cityData?.setTimeOfDay) {
      cityData.setTimeOfDay(timeOfDay);
    }
  }, [timeOfDay]);

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
    const isNightScene = timeOfDayRef.current === 'cyber-night';
    const isDayScene = timeOfDayRef.current === 'daylight';
    scene.background = groundSkyColorRef.current.clone();
    scene.fog = new THREE.FogExp2(isNightScene ? 0x0b1528 : isDayScene ? 0xbae6fd : 0xb0cbd0, 0.00105);

    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.5, 95000);
    cameraRef.current = camera;

    // Integrated Radeon graphics: avoid high-DPI + MSAA + bloom at the same time.
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    rendererRef.current = renderer;
    renderer.setPixelRatio(1);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // --- POST-PROCESSING (Bloom for Heat Vision & Motion Blur for Supersonic) ---
    const postProcessing = setupPostProcessing(renderer, scene, camera);
    postProcessingRef.current = postProcessing;

    // --- LIGHTING (Cinematic Golden Hour / Atardecer Dorado & ACES Tone Mapping) ---
    const hemiLight = new THREE.HemisphereLight(
      isNightScene ? 0x1e293b : isDayScene ? 0x7dd3fc : 0x9bd3e2,
      isNightScene ? 0x090d16 : isDayScene ? 0x334155 : 0x394d3f,
      isNightScene ? 0.65 : isDayScene ? 1.35 : 1.3
    );
    hemiLightRef.current = hemiLight;
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(
      isNightScene ? 0x38bdf8 : isDayScene ? 0xfffbeb : 0xffa257,
      isNightScene ? 1.35 : isDayScene ? 3.5 : 3.2
    );
    sunLight.position.set(1600, 750, -1800);
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
    sunLightRef.current = sunLight;
    scene.add(sunLight);

    // Warm Sunset Rim Light
    const rimLight = new THREE.DirectionalLight(
      isNightScene ? 0xa855f7 : isDayScene ? 0x38bdf8 : 0xf59e0b,
      isNightScene ? 0.9 : isDayScene ? 0.65 : 0.85
    );
    rimLight.position.set(-1200, 400, 1400);
    rimLightRef.current = rimLight;
    scene.add(rimLight);

    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;

    // --- BUILD BOGOTÁ ---
    const cityData = buildBogotaCity(scene);
    cityData.setTimeOfDay?.(timeOfDayRef.current);
    cityDataRef.current = cityData;

    // --- TRAFFIC SYSTEM ---
    const traffic = new TrafficSystem(scene);
    trafficRef.current = traffic;

    // --- SUPERMAN RIG ---
    const superman = createSupermanCharacter(scene);
    supermanRef.current = superman;
    void superman.loadExternalModel?.('/models/superman-bogota.glb');

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
      cityData.terrainMeshes.forEach((mesh) => physics.addTerrainCollider(mesh));
      physics.addPlayerController();
    });

    const destruction = new DestructionSystem(scene, physics);
    destructionRef.current = destruction;

    const combat = new CombatSystem(scene, physics, destruction, crime, traffic);
    combatRef.current = combat;

    const profileOrder: GraphicQualityProfile[] = [
      'radeon-optimized',
      'balanced-30',
      'ultra-fidelity',
    ];

    // Frame timing history for real-time P95, Avg & Min FPS metrics
    const frameTimesBuffer: number[] = [];
    let currentMetrics: PerformanceMetrics = {
      fps: 60,
      avgFps: 60,
      minFps: 58,
      frameTimeMs: 16.6,
      p95FrameTimeMs: 18.0,
      drawCalls: 0,
      triangles: 0,
      dynamicObjectsCount: 0,
      activeProfile: graphicProfileRef.current,
    };

    // --- INPUT LISTENERS ---
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'F7' && !e.repeat) {
        e.preventDefault();
        const nextIdx = (profileOrder.indexOf(graphicProfileRef.current) + 1) % profileOrder.length;
        onSelectGraphicProfile(profileOrder[nextIdx]);
        return;
      }
      if (e.code === 'F8' && !e.repeat) {
        e.preventDefault();
        onTogglePerfHud();
        return;
      }
      if (e.code === 'KeyT' && !e.repeat) {
        e.preventDefault();
        onCycleTimeOfDay();
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
      if ((e.code === 'KeyC' || e.code === 'KeyG') && !e.repeat) {
        isFlyingRef.current = !isFlyingRef.current;
        if (!isFlyingRef.current) {
          posRef.current.y = 0.0;
          velRef.current.y = 0;
        } else {
          velRef.current.y = 22;
        }
      }

      // KEY Q / TAB: TARGET LOCK-ON (AERIAL & GROUND)
      if ((e.code === 'KeyQ' || e.code === 'Tab') && !e.repeat) {
        e.preventDefault();
        performLockOnAction();
      }

      // KEY F: GRAB & THROW VEHICLES / ENEMIES + GROUND SLAM
      if (e.code === 'KeyF' && !e.repeat) {
        performGrabOrSlamAction();
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
        // Ignore clicks on UI buttons inside header/HUD
        const targetEl = e.target as HTMLElement | null;
        if (targetEl && targetEl.tagName !== 'CANVAS') return;

        isMouseDownRef.current = true;
        mousePosRef.current = { x: e.clientX, y: e.clientY };
        performPunchAction();
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      if (isMouseDownRef.current) {
        const dx = e.clientX - mousePosRef.current.x;
        const dy = e.clientY - mousePosRef.current.y;
        mousePosRef.current = { x: e.clientX, y: e.clientY };

        // Moving mouse left/right rotates Superman's heading directly
        rotYRef.current -= dx * 0.005;

        // Moving mouse up/down adjusts the downward-facing pitch angle
        cameraPitchRef.current = Math.max(-0.35, Math.min(0.35, cameraPitchRef.current + dy * 0.003));
      }
    };

    const onWheel = (e: WheelEvent) => {
      if (isFlyingRef.current) {
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

    // --- MAIN GAME LOOP ---
    let lastTime = performance.now();

    const animate = (time: number) => {
      animFrameIdRef.current = requestAnimationFrame(animate);
      const rawDtMs = Math.max(1, time - lastTime);
      const delta = Math.min(rawDtMs / 1000, 0.1);
      lastTime = time;
      wallImpactCooldownRef.current = Math.max(0, wallImpactCooldownRef.current - delta);

      // Track frame time buffer (last 90 frames)
      frameTimesBuffer.push(rawDtMs);
      if (frameTimesBuffer.length > 90) frameTimesBuffer.shift();

      // Let the Colombian flag above Plaza de Bolívar catch the light.
      if (cityData.dailyPlanetGlobe) {
        cityData.dailyPlanetGlobe.rotation.y += delta * 0.4;
      }

      // Input parsing: Supersonic is triggered by Right Click hold OR Double Tap W OR externalSupersonic
      const isSupersonicTriggered =
        isRightMouseDownRef.current ||
        isDoubleTapWActiveRef.current ||
        Boolean(externalSupersonicRef.current);
      const isSupersonicNow = isSupersonicTriggered && isFlyingRef.current;
      isSupersonicRef.current = isSupersonicNow;

      // Descend / Dive: SHIFT, CTRL, Z or PageDown (Q is dedicated to Lock-On, C to Toggle Flight)
      const isShiftDown = Boolean(
        keysRef.current['ShiftLeft'] ||
          keysRef.current['ShiftRight'] ||
          externalDescendRef.current
      );

      let moveForward = 0;
      let moveTurn = 0;
      let moveUp = 0;

      if (keysRef.current['KeyW'] || keysRef.current['ArrowUp']) moveForward += 1;
      if (keysRef.current['KeyS'] || keysRef.current['ArrowDown']) moveForward -= 0.6;
      if (keysRef.current['KeyA'] || keysRef.current['ArrowLeft']) moveTurn += 1;
      if (keysRef.current['KeyD'] || keysRef.current['ArrowRight']) moveTurn -= 1;

      if (keysRef.current['Space'] || externalAscendRef.current) moveUp += 1;

      if (
        isShiftDown ||
        keysRef.current['ControlLeft'] ||
        keysRef.current['ControlRight'] ||
        keysRef.current['KeyZ'] ||
        keysRef.current['PageDown']
      ) {
        moveUp -= 1;
      }

      // Merge mobile virtual joystick input
      if (externalMoveRef.current.dx !== 0 || externalMoveRef.current.dz !== 0) {
        moveTurn -= externalMoveRef.current.dx * 1.5;
        moveForward -= externalMoveRef.current.dz;
      }

      // Turn Superman smoothly with A/D or touch
      if (moveTurn !== 0) {
        rotYRef.current += moveTurn * delta * 2.8;
      }

      // Banking roll when turning in flight
      pitchRef.current = THREE.MathUtils.lerp(pitchRef.current, moveTurn * 0.45, delta * 8.0);

      const isDiving = isFlyingRef.current && (isShiftDown || moveUp < 0);
      isDivingRef.current = isDiving;

      const forwardDirX = -Math.sin(rotYRef.current);
      const forwardDirZ = -Math.cos(rotYRef.current);

      // Speed calculations
      const speedMultiplier = isSupersonicRef.current
        ? isFlyingRef.current
          ? 400
          : 92
        : isFlyingRef.current
        ? 58
        : 10;

      // INSTANT SUPERSONIC IMPULSE TRIGGER
      if (isSupersonicNow && !wasSupersonicLastFrameRef.current) {
        superman.triggerInstantSonicBoom();
        audioService.playInstantSonicBoom();
        cameraShakeTimerRef.current = 0.42;
        cameraShakeIntensityRef.current = 1.8;
        camera.fov = 92;
        camera.updateProjectionMatrix();

        velRef.current.x = forwardDirX * speedMultiplier;
        velRef.current.z = forwardDirZ * speedMultiplier;
      }
      wasSupersonicLastFrameRef.current = isSupersonicNow;

      // Acrobatic Barrel Roll Maneuver during flight
      if (
        isFlyingRef.current &&
        (isSupersonicNow || Math.hypot(velRef.current.x, velRef.current.z) > 40)
      ) {
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

      const accelRate = Math.min(1, delta * (isSupersonicRef.current ? 3.2 : 2.1));
      velRef.current.x = THREE.MathUtils.lerp(velRef.current.x, targetVx, accelRate);
      velRef.current.z = THREE.MathUtils.lerp(velRef.current.z, targetVz, accelRate);

      // Vertical flight and descending dynamics
      if (isFlyingRef.current) {
        if (moveUp > 0) {
          const targetVy = isSupersonicRef.current ? 70 : 38;
          velRef.current.y = THREE.MathUtils.lerp(velRef.current.y, targetVy, Math.min(1, delta * 3.5));
        } else if (moveUp < 0) {
          const targetVy = isSupersonicRef.current ? -95 : -52;
          velRef.current.y = THREE.MathUtils.lerp(velRef.current.y, targetVy, Math.min(1, delta * 4.5));
        } else {
          velRef.current.y = THREE.MathUtils.lerp(velRef.current.y, 0, Math.min(1, delta * 2.8));
        }
      } else {
        if (moveUp > 0) {
          isFlyingRef.current = true;
          velRef.current.y = 10;
        } else {
          velRef.current.y = Math.max(-65, velRef.current.y - 9.81 * delta);
        }
      }

      // Swept Rapier capsule movement stops tunneling through façades and roofs.
      const requestedMove = new THREE.Vector3(
        velRef.current.x * delta,
        velRef.current.y * delta,
        velRef.current.z * delta
      );
      const landingSpeed = velRef.current.y;
      const wasDescending = landingSpeed < -2;
      const playerPosition = new THREE.Vector3(posRef.current.x, posRef.current.y, posRef.current.z);
      const resolvedMove = physicsRef.current?.movePlayer(playerPosition, requestedMove) ?? null;
      if (resolvedMove) {
        posRef.current.x += resolvedMove.delta.x;
        posRef.current.y += resolvedMove.delta.y;
        posRef.current.z += resolvedMove.delta.z;
        const requestedHorizontal = Math.hypot(requestedMove.x, requestedMove.z);
        const movedHorizontal = Math.hypot(resolvedMove.delta.x, resolvedMove.delta.z);
        if (
          resolvedMove.hit &&
          !resolvedMove.grounded &&
          wallImpactCooldownRef.current <= 0 &&
          requestedHorizontal > 8 &&
          movedHorizontal < requestedHorizontal * 0.55
        ) {
          const impactSpeed = Math.hypot(velRef.current.x, velRef.current.z);
          if (impactSpeed > 24 && destructionRef.current) {
            destructionRef.current.triggerImpact(
              playerPosition,
              new THREE.Vector3(-velRef.current.x, 0, -velRef.current.z).normalize(),
              Math.min(125, impactSpeed * 1.8),
              true
            );
            cameraShakeTimerRef.current = 0.28;
            cameraShakeIntensityRef.current = Math.min(1.8, impactSpeed * 0.012);
            wallImpactCooldownRef.current = 0.8;
          }
        }
        if (Math.abs(resolvedMove.delta.x - requestedMove.x) > 0.03) velRef.current.x *= 0.08;
        if (Math.abs(resolvedMove.delta.z - requestedMove.z) > 0.03) velRef.current.z *= 0.08;
        if (Math.abs(resolvedMove.delta.y - requestedMove.y) > 0.03) velRef.current.y = 0;
        if (resolvedMove.grounded && !isFlyingRef.current) velRef.current.y = Math.max(0, velRef.current.y);
      } else {
        posRef.current.x += requestedMove.x;
        posRef.current.y += requestedMove.y;
        posRef.current.z += requestedMove.z;
      }

      posRef.current.x = Math.max(-1100, Math.min(1100, posRef.current.x));
      posRef.current.z = Math.max(-1100, Math.min(1100, posRef.current.z));
      if (posRef.current.y > 1500) {
        posRef.current.y = 1500;
        velRef.current.y = Math.min(0, velRef.current.y);
      }

      // Ground limit and Hero Landing impact
      if (posRef.current.y <= 0.08 || (resolvedMove?.grounded && wasDescending)) {
        if (wasDescending && Math.abs(landingSpeed) > 16 && !isHeroLandingRef.current) {
          isHeroLandingRef.current = true;
          heroLandingTimerRef.current = 0.55;
          isFlyingRef.current = false;

          superman.triggerGroundSlamShockwave();
          audioService.playGroundSlam();
          destruction.triggerImpact(
            new THREE.Vector3(posRef.current.x, Math.max(0.05, posRef.current.y), posRef.current.z),
            new THREE.Vector3(0, 1, 0),
            Math.min(125, Math.abs(landingSpeed) * 3.8)
          );
          traffic.triggerTrafficPanic(posRef.current.x, posRef.current.z, 35);

          cameraShakeTimerRef.current = 0.38;
          cameraShakeIntensityRef.current = Math.min(2.5, Math.abs(landingSpeed) * 0.05);

          if (crimeRef.current) {
            const hits = crimeRef.current.handleGroundSlamHit(posRef.current.x, posRef.current.z, 24);
            if (hits > 0) onMissionCompleted(hits * 10);
          }
        }
        if (posRef.current.y <= 0.08) posRef.current.y = 0.0;
        velRef.current.y = 0;
      }

      if (heroLandingTimerRef.current > 0) {
        heroLandingTimerRef.current -= delta;
        if (heroLandingTimerRef.current <= 0) {
          isHeroLandingRef.current = false;
        }
      }

      if (cameraShakeTimerRef.current > 0) {
        cameraShakeTimerRef.current -= delta;
      }

      // Atmospheric haze thins gradually over the high-altitude Bogotá basin.
      const alt = posRef.current.y;
      if (scene.fog) {
        (scene.fog as THREE.FogExp2).density = THREE.MathUtils.lerp(0.00105, 0.00034, THREE.MathUtils.clamp(alt / 1300, 0, 1));
      }

      // Building Collision detection & Vertical Wall Running / Rooftop Catapult Vault
      if (!resolvedMove && posRef.current.y < 280) {
        const col = cityData.checkCollision(posRef.current.x, posRef.current.y, posRef.current.z, 2.0);
        if (col.hit) {
          posRef.current.x += col.pushX * 1.05;
          posRef.current.z += col.pushZ * 1.05;

          const bHeight = col.buildingHeight || 65;
          const isPushingAgainstWall =
            (moveForward > 0 || Math.hypot(velRef.current.x, velRef.current.z) > 8) &&
            posRef.current.y < bHeight - 1.0;

          if (isPushingAgainstWall) {
            isWallRunningRef.current = true;
            isFlyingRef.current = false;

            velRef.current.y = 52;
            posRef.current.y += 52 * delta;

            wallRunStrideTimerRef.current += delta;
            if (wallRunStrideTimerRef.current > 0.12) {
              wallRunStrideTimerRef.current = 0;
              audioService.playWallRunStride();
            }

            if (posRef.current.y >= bHeight - 2.0) {
              posRef.current.y = bHeight + 2.5;
              velRef.current.y = 44;
              velRef.current.x = forwardDirX * 52;
              velRef.current.z = forwardDirZ * 52;
              isFlyingRef.current = true;
              isWallRunningRef.current = false;
              cameraShakeTimerRef.current = 0.28;
              cameraShakeIntensityRef.current = 1.3;
              onMissionCompleted(15);
            }
          } else {
            isWallRunningRef.current = false;
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
      const mach = speedKmh > 1225 ? speedKmh / 1225 : 0;

      audioService.updateWindSound(totalSpeed / 160, isSupersonicRef.current);

      // Solar energy recharge
      const isSolarCharging = posRef.current.y > 550;
      if (isSolarCharging) {
        solarEnergyRef.current = Math.min(100, solarEnergyRef.current + delta * 28);
        healthRef.current = Math.min(100, healthRef.current + delta * 15);
      } else if (posRef.current.y > 80) {
        solarEnergyRef.current = Math.min(100, solarEnergyRef.current + delta * 1.8);
      } else {
        solarEnergyRef.current = Math.min(100, solarEnergyRef.current + delta * 0.6);
      }

      if (isSupersonicRef.current && speedKmh > 400 && Math.random() < 0.015) {
        audioService.playSonicBoom();
      }

      // Power triggers (respecting solar energy > 0)
      const hasSolar = solarEnergyRef.current > 0.5;
      const isFiringHeat =
        hasSolar &&
        (Boolean(keysRef.current['KeyR']) ||
          Boolean(keysRef.current['Digit1']) ||
          externalPowerTriggerRef.current === 'heat-vision');

      const isFiringFreeze =
        hasSolar &&
        (Boolean(keysRef.current['KeyE']) ||
          Boolean(keysRef.current['Digit2']) ||
          externalPowerTriggerRef.current === 'freeze-breath');

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
      const playerVec = new THREE.Vector3(posRef.current.x, posRef.current.y, posRef.current.z);
      if (combatRef.current) {
        combatRef.current.update(delta, playerVec, rotYRef.current, aimDir);
      }

      // Update Superman mesh pose and position
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
        npcs.update(
          posRef.current.x,
          posRef.current.y,
          posRef.current.z,
          delta,
          isSupersonicRef.current,
          isHeroLandingRef.current
        );
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
        activePowerRef.current,
        rotYRef.current
      );

      if (crimeRes.missionCompleted) {
        onMissionCompleted(crime.getActiveMission().rewardHope);
      }

      // Camera Framing: AAA Cinematic Third-Person Framing
      const isHighAltitude = posRef.current.y > 650;
      const camDist = isHighAltitude
        ? 16.5
        : isSupersonicRef.current
        ? 16.5
        : isFlyingRef.current
        ? 11.2
        : 4.8;
      const camElevation = isHighAltitude
        ? 5.8
        : isSupersonicRef.current
        ? 5.8
        : isFlyingRef.current
        ? 4.6
        : 1.85;

      const shoulderOffset = isFlyingRef.current || isHighAltitude ? 0.0 : 0.42;
      const rightX = Math.cos(rotYRef.current) * shoulderOffset;
      const rightZ = -Math.sin(rotYRef.current) * shoulderOffset;

      let targetCamX = posRef.current.x + Math.sin(rotYRef.current) * camDist + rightX;
      let targetCamZ = posRef.current.z + Math.cos(rotYRef.current) * camDist + rightZ;
      let targetCamY = posRef.current.y + camElevation;

      if (cityData.checkCollision && !isHighAltitude) {
        const camCol = cityData.checkCollision(targetCamX, targetCamY, targetCamZ, 1.2);
        if (camCol.hit) {
          targetCamX = posRef.current.x + Math.sin(rotYRef.current) * 2.8 + rightX * 0.5;
          targetCamZ = posRef.current.z + Math.cos(rotYRef.current) * 2.8 + rightZ * 0.5;
          targetCamY = posRef.current.y + 1.85;
        }
      }

      const lookAheadDist = isSupersonicRef.current ? 22.0 : 15.0;
      let lookTargetX = posRef.current.x - Math.sin(rotYRef.current) * lookAheadDist;
      let lookTargetZ = posRef.current.z - Math.cos(rotYRef.current) * lookAheadDist;
      let lookTargetY =
        posRef.current.y +
        (isFlyingRef.current ? (isDiving ? -9.5 : -0.5) : 1.45) -
        cameraPitchRef.current * 5.5;

      if (combatRef.current?.isLockOnActive && combatRef.current?.lockedTarget) {
        lookTargetX = combatRef.current.lockedTarget.x;
        lookTargetY = combatRef.current.lockedTarget.y + 1.0;
        lookTargetZ = combatRef.current.lockedTarget.z;
      }

      if (cameraShakeTimerRef.current > 0) {
        const shake = cameraShakeIntensityRef.current * (cameraShakeTimerRef.current / 0.35);
        targetCamX += (Math.random() - 0.5) * shake;
        targetCamY += (Math.random() - 0.5) * shake;
        targetCamZ += (Math.random() - 0.5) * shake;
      }

      tempCamTargetRef.current.set(targetCamX, targetCamY, targetCamZ);
      tempLookTargetRef.current.set(lookTargetX, lookTargetY, lookTargetZ);
      camera.position.lerp(tempCamTargetRef.current, delta * 10.0);
      currentLookAtRef.current.lerp(tempLookTargetRef.current, delta * 12.0);
      camera.lookAt(currentLookAtRef.current);

      // Dynamic FOV
      const targetFOV = isSupersonicRef.current ? 86 : isFlyingRef.current ? 68 : 60;
      const newFov = THREE.MathUtils.lerp(camera.fov, targetFOV, delta * 5);
      if (Math.abs(newFov - camera.fov) > 0.002) {
        camera.fov = newFov;
        camera.updateProjectionMatrix();
      }

      // Dynamic LOD & Skyscraper Culling
      if (cityData.updateLOD && throttleCounterRef.current % 6 === 0) {
        cityData.updateLOD(camera.position);
      }

      postProcessing.update(delta, isFiringHeat, isSupersonicRef.current, mach);
      postProcessing.render();

      // React HUD/minimap/profiler update at ~10 Hz
      throttleCounterRef.current++;
      if (throttleCounterRef.current % 6 === 0) {
        if (frameTimesBuffer.length > 0) {
          const sumMs = frameTimesBuffer.reduce((acc, v) => acc + v, 0);
          const avgMs = sumMs / frameTimesBuffer.length;
          const sorted = [...frameTimesBuffer].sort((a, b) => a - b);
          const p95Ms = sorted[Math.floor(sorted.length * 0.95)] || avgMs;
          const maxMs = sorted[sorted.length - 1] || avgMs;
          const info = renderer.info.render;

          currentMetrics = {
            fps: Math.min(120, Math.round(1000 / Math.max(1, rawDtMs))),
            avgFps: Math.min(120, Math.round(1000 / Math.max(1, avgMs))),
            minFps: Math.min(120, Math.round(1000 / Math.max(1, maxMs))),
            frameTimeMs: avgMs,
            p95FrameTimeMs: p95Ms,
            drawCalls: info.calls,
            triangles: info.triangles,
            dynamicObjectsCount: physics.getDynamicObjectsCount(),
            activeProfile: graphicProfileRef.current,
          };
        }

        onUpdateState({
          playerX: posRef.current.x,
          playerZ: posRef.current.z,
          playerRotationY: rotYRef.current,
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
          activeEnemies: crime.getEnemies(),
          isHoldingObject: combatRef.current?.isHolding,
          hasLockedTarget: combatRef.current?.isLockOnActive,
          lockedTargetInfo: combatRef.current?.getLockedTargetInfo(playerVec),
          comboStep: combatRef.current?.getComboStep(),
          citizenDialogue: npcs.getActiveDialogue(),
          performanceMetrics: currentMetrics,
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
      crime.dispose();
      destruction.dispose();
      physics.dispose();
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
