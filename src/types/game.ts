export type PowerType = 'heat-vision' | 'freeze-breath' | 'ground-slam' | 'x-ray';

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

export type MissionType = 'bank-heist' | 'skyscraper-fire' | 'car-chase' | 'lexcorp-drones';

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
}

export interface TrafficCar {
  id: string;
  x: number;
  y: number;
  z: number;
  rotationY: number;
  speed: number;
  color: string;
  type: 'taxi' | 'police' | 'sedan' | 'truck';
  lane: 'north-south' | 'east-west';
  direction: 1 | -1;
  frozen?: boolean;
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
