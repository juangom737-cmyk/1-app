export type PowerType = 'heat-vision' | 'freeze-breath' | 'ground-slam' | 'x-ray';

export type TimeOfDayMode = 'golden-hour' | 'daylight' | 'cyber-night';

export interface LockedTargetInfo {
  id: string;
  type: EnemyEntity['type'];
  health: number;
  maxHealth: number;
  distance: number;
}

export interface SupermanState {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rotationY: number;
  pitch: number;
  isFlying: boolean;
  isSupersonic: boolean;
  isGrounded: boolean;
  health: number;
  maxHealth: number;
  solarEnergy: number; // 0 - 100%
  speedKmh: number;
  mach: number;
  activePower: PowerType | null;
  xrayActive: boolean;
  isWallRunning?: boolean;
  isHoldingObject?: boolean;
  hasLockedTarget?: boolean;
  comboStep?: number;
}

export type MissionType =
  | 'bank-heist'
  | 'skyscraper-fire'
  | 'car-chase'
  | 'lexcorp-drones'
  | 'star-labs-breach'
  | 'bridge-collapse';

export interface Mission {
  id: string;
  type: MissionType;
  title: string;
  locationName: string;
  x: number;
  y: number;
  z: number;
  description: string;
  objectiveText: string;
  progress: number;
  maxProgress: number;
  rewardHope: number;
  completed: boolean;
  active: boolean;
  iconColor: string;
}

export interface EnemyEntity {
  id: string;
  type: 'thug' | 'drone' | 'fire' | 'getaway-car';
  x: number;
  y: number;
  z: number;
  health: number;
  maxHealth: number;
  active: boolean;
  speed?: number;
  targetX?: number;
  targetZ?: number;
  frozen?: boolean;
  freezeProgress?: number;
  hitFlashTimer?: number;
}

export interface TrafficCar {
  id: string;
  x: number;
  y: number;
  z: number;
  rotationY: number;
  speed: number;
  color: string;
  type: 'taxi' | 'police' | 'sedan' | 'truck' | 'transmilenio';
  lane: 'north-south' | 'east-west';
  direction: 1 | -1;
  frozen?: boolean;
  panicTimer?: number;
}

export interface CityBuilding {
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  name?: string;
  isIconic?: boolean;
  color?: string;
}

export type GraphicQualityProfile = 'radeon-optimized' | 'balanced-30' | 'ultra-fidelity';

export interface PerformanceMetrics {
  fps: number;
  avgFps: number;
  minFps: number;
  frameTimeMs: number;
  p95FrameTimeMs: number;
  drawCalls: number;
  triangles: number;
  dynamicObjectsCount?: number;
  activeProfile: GraphicQualityProfile;
}
