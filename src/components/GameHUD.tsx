import React, { useState } from 'react';
import { PowerType, Mission } from '../types/game';
import { Flame, Snowflake, Zap, Eye, Volume2, VolumeX, HelpCircle, Sun, Heart, ChevronDown, ChevronUp, Shield } from 'lucide-react';

interface GameHUDProps {
  health: number;
  maxHealth: number;
  solarEnergy: number;
  speedKmh: number;
  mach: number;
  isFlying: boolean;
  isSupersonic: boolean;
  activePower: PowerType | null;
  xrayActive: boolean;
  activeMission: Mission | null;
  hopeLevel: number;
  altMeters?: number;
  isMuted: boolean;
  onToggleMute: () => void;
  onOpenHelp: () => void;
  onSelectPower: (power: PowerType) => void;
  onSwitchMission: (index: number) => void;
  missionList: Mission[];
  currentMissionIndex: number;
  minimapNode?: React.ReactNode;
  isHoldingObject?: boolean;
  hasLockedTarget?: boolean;
  comboStep?: number;
  citizenDialogue?: string | null;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  health,
  maxHealth,
  solarEnergy,
  speedKmh,
  mach,
  isFlying,
  isSupersonic,
  activePower,
  xrayActive,
  activeMission,
  hopeLevel,
  altMeters = 80,
  isMuted,
  onToggleMute,
  onOpenHelp,
  onSelectPower,
  onSwitchMission,
  missionList,
  currentMissionIndex,
  minimapNode,
  isHoldingObject = false,
  hasLockedTarget = false,
  comboStep = 0,
  citizenDialogue = null,
}) => {
  const [isMissionMinimized, setIsMissionMinimized] = useState(() => {
    return typeof window !== 'undefined' ? window.innerWidth < 1024 : false;
  });

  return (
    <div className="absolute inset-0 pointer-events-none select-none flex flex-col justify-between p-4 z-20">
      {/* Dynamic Citizen Reaction Dialogue Popup */}
      {citizenDialogue && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-40 pointer-events-none animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-2.5 px-5 py-2.5 rounded-2xl bg-slate-950/90 text-amber-300 text-xs font-semibold shadow-2xl backdrop-blur-md border border-amber-400/80">
            <span className="font-hud tracking-wider text-amber-400 uppercase text-[11px] font-bold">
              CIUDADANO:
            </span>
            <span className="italic text-white">"{citizenDialogue}"</span>
          </div>
        </div>
      )}

      {/* --- TOP BAR (Strict Top Bar Contract) --- */}
      <header className="pointer-events-auto flex items-center justify-between gap-8 px-6 py-3.5 bg-slate-950/85 backdrop-blur-md rounded-2xl border border-slate-800 shadow-2xl">
        {/* Zone 1: Brand Wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-lg font-extrabold tracking-wider text-white font-hud whitespace-nowrap shrink-0">
            METROPOLIS 3D
          </span>
          <span className="hidden sm:inline text-xs text-rose-500 font-semibold uppercase tracking-wider">
            Superman Sandbox
          </span>
        </div>

        {/* Zone 2: Clean unboxed metadata with typographic separators */}
        <nav className="hidden md:flex items-center gap-6 text-xs text-slate-300 font-medium">
          <span className="text-white whitespace-nowrap shrink-0">
            Modo: {isFlying ? (isSupersonic ? 'Vuelo Supersónico' : 'Vuelo Libre') : 'Patrulla a Pie'}
          </span>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span className="text-amber-400 whitespace-nowrap shrink-0">
            Esperanza Ciudadana: {Math.round(hopeLevel)}%
          </span>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span className="text-sky-400 whitespace-nowrap shrink-0">
            Radiación Solar: {Math.round(solarEnergy)}%
          </span>
          {isHoldingObject && (
            <>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className="text-amber-300 font-extrabold animate-pulse whitespace-nowrap shrink-0 bg-amber-500/20 px-2 py-0.5 rounded border border-amber-400">
                VEHÍCULO SOSTENIDO [F / CLIC LANZAR]
              </span>
            </>
          )}
          {hasLockedTarget && (
            <>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className="text-rose-400 font-extrabold animate-pulse whitespace-nowrap shrink-0 bg-rose-500/20 px-2 py-0.5 rounded border border-rose-500">
                BLANCO FIJADO [Q]
              </span>
            </>
          )}
          {xrayActive && (
            <>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className="text-cyan-400 font-semibold animate-pulse whitespace-nowrap shrink-0">
                RAYOS X ACTIVOS
              </span>
            </>
          )}
        </nav>

        {/* Zone 3: Primary Action & Controls */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onToggleMute}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700/60"
            title={isMuted ? 'Activar Sonido' : 'Silenciar'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-sky-400" />}
          </button>

          <button
            onClick={onOpenHelp}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors border border-slate-700 whitespace-nowrap shrink-0"
          >
            <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
            <span>Controles</span>
          </button>
        </div>
      </header>

      {/* --- MIDDLE OVERLAY: ACTIVE DISPATCH BANNER & SPEEDOMETER --- */}
      <div className="flex justify-between items-start mt-4 px-2">
        {/* Left: Health, Solar Energy & Speedometer */}
        <div className="pointer-events-auto flex flex-col gap-2 p-3 bg-slate-950/75 backdrop-blur-md rounded-2xl border border-slate-800/80 shadow-xl max-w-[240px]">
          {/* Health Bar */}
          <div>
            <div className="flex justify-between text-[11px] font-bold text-slate-300 mb-1">
              <span className="flex items-center gap-1">
                <Heart className="w-3 h-3 text-rose-500 fill-rose-500" /> Invulnerabilidad
              </span>
              <span className="font-mono tabular-nums text-rose-400">{Math.round(health)}%</span>
            </div>
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-rose-600 to-rose-400 transition-all duration-300"
                style={{ width: `${(health / maxHealth) * 100}%` }}
              />
            </div>
          </div>

          {/* Solar Energy Bar */}
          <div>
            <div className="flex justify-between text-[11px] font-bold text-slate-300 mb-1">
              <span className="flex items-center gap-1">
                <Sun className="w-3 h-3 text-amber-400 fill-amber-400" /> Batería Solar
              </span>
              <span className="font-mono tabular-nums text-amber-400">{Math.round(solarEnergy)}%</span>
            </div>
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all duration-300"
                style={{ width: `${solarEnergy}%` }}
              />
            </div>
          </div>

          {/* Speedometer display */}
          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Velocidad</span>
              {isSupersonic && (
                <span className="text-[9px] font-mono font-bold text-amber-300 bg-amber-950/80 px-1.5 py-0.5 rounded border border-amber-600 animate-pulse">
                  {isFlying ? 'MACH SUPERSONIC' : 'SÚPER SPRINT (SUELO)'}
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-1">
              <span className={`text-base font-bold font-hud tabular-nums ${isSupersonic ? 'text-amber-300' : 'text-sky-300'}`}>
                {mach > 0.9 ? `MACH ${mach.toFixed(1)}` : `${Math.round(speedKmh)} km/h`}
              </span>
            </div>
          </div>

          {/* Altitude indicator */}
          <div className="pt-1.5 border-t border-slate-800/80 flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Altitud</span>
            <span className={`text-xs font-bold font-mono tabular-nums ${altMeters > 550 ? 'text-amber-400 animate-pulse font-hud' : 'text-sky-300'}`}>
              {altMeters > 550 ? `${Math.round(altMeters)}m · ÓRBITA` : `${Math.round(altMeters)}m`}
            </span>
          </div>
        </div>

        {/* Center: Solar Energy Absorption Indicator in Outer Space */}
        {altMeters > 550 && (
          <div className="pointer-events-none mx-auto -mt-1 px-4 py-1.5 rounded-2xl bg-amber-950/80 border border-amber-400/60 backdrop-blur-md shadow-2xl flex items-center gap-2.5 animate-pulse">
            <Sun className="w-4 h-4 text-amber-300 animate-spin" />
            <div className="flex flex-col">
              <span className="text-[11px] font-extrabold text-amber-300 uppercase tracking-widest font-hud">
                ÓRBITA ESPACIAL // RADIACIÓN SOLAR PURA
              </span>
              <span className="text-[10px] text-amber-200/90 font-mono">
                +28% Batería Solar/seg · Regeneración Activa
              </span>
            </div>
          </div>
        )}

        {/* Right: Stacked Minimap Radar + Mission Dispatch Card */}
        <div className="flex flex-col items-end gap-2.5 pointer-events-auto">
          {minimapNode}

          {activeMission && (
            <div>
              {isMissionMinimized ? (
                /* Minimized Compact Pill View */
                <div
                  onClick={() => setIsMissionMinimized(false)}
                  className="flex items-center gap-3 px-4 py-2.5 bg-slate-950/85 backdrop-blur-md rounded-2xl border border-rose-500/50 shadow-2xl hover:bg-slate-900/90 hover:border-rose-400 transition-all cursor-pointer group"
                  title="Haga clic para expandir la ventana de misiones"
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider font-hud">
                        Misión {currentMissionIndex + 1}/{missionList.length}
                      </span>
                      <span className="text-[10px] text-amber-400 font-mono font-hud">
                        +{activeMission.rewardHope}
                      </span>
                    </div>
                    <span className="text-xs font-semibold text-white truncate max-w-[170px]">
                      {activeMission.title}
                    </span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsMissionMinimized(false);
                    }}
                    className="p-1.5 rounded-xl bg-slate-800/80 group-hover:bg-rose-600/30 text-slate-300 group-hover:text-white transition-colors"
                    title="Expandir Ventana"
                  >
                    <ChevronDown className="w-3.5 h-3.5 text-rose-400" />
                  </button>
                </div>
              ) : (
                /* Expanded Full Mission Card View */
                <div className="max-w-sm p-4 bg-slate-950/85 backdrop-blur-md rounded-2xl border border-rose-500/40 shadow-2xl flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                      <span className="text-[11px] font-bold text-rose-400 uppercase tracking-wider font-hud">
                        Despacho Policial // En Curso
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono tabular-nums text-amber-400 font-hud">
                        +{activeMission.rewardHope} Esperanza
                      </span>
                      <button
                        onClick={() => setIsMissionMinimized(true)}
                        className="p-1 rounded-lg bg-slate-800/60 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                        title="Minimizar ventana de misiones"
                      >
                        <ChevronUp className="w-3.5 h-3.5 text-slate-300" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-white leading-snug">{activeMission.title}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">{activeMission.objectiveText}</p>
                  </div>

                  {/* Objective Progress Bar */}
                  <div className="mt-1">
                    <div className="flex justify-between text-[11px] font-medium text-slate-400 mb-1">
                      <span>Progreso de Contención</span>
                      <span className="font-mono tabular-nums text-white">
                        {activeMission.progress} / {activeMission.maxProgress}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-rose-500 transition-all duration-300"
                        style={{ width: `${(activeMission.progress / activeMission.maxProgress) * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* Switch Mission Selector */}
                  <div className="flex items-center gap-1.5 pt-2 border-t border-slate-800/80 mt-1">
                    <span className="text-[10px] text-slate-400 mr-1">Alertas:</span>
                    {missionList.map((m, idx) => (
                      <button
                        key={m.id}
                        onClick={() => onSwitchMission(idx)}
                        className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-colors ${
                          idx === currentMissionIndex
                            ? 'bg-rose-500 text-white'
                            : 'bg-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {idx + 1}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* --- BOTTOM POWER ACTIONS DOCK (Desktop) --- */}
      <div className="hidden md:flex justify-center items-end pb-2">
        <div className="pointer-events-auto flex items-center gap-2 p-2 bg-slate-950/85 backdrop-blur-md rounded-2xl border border-slate-800 shadow-2xl">
          {/* 0. Super Melee Punch (Left Mouse Button) */}
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/40">
            <Zap className="w-4 h-4 text-amber-400" />
            <div className="text-left">
              <div className="leading-none text-white">Puñetazo</div>
              <div className="text-[10px] text-amber-400 font-mono">Clic Izq</div>
            </div>
          </div>

          {/* 1. Heat Vision */}
          <button
            onClick={() => onSelectPower('heat-vision')}
            className={`flex items-center gap-2.5 px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
              activePower === 'heat-vision'
                ? 'bg-rose-600 text-white border-rose-400 shadow-lg shadow-rose-900/50'
                : 'bg-slate-900 text-slate-300 border-slate-700/60 hover:border-rose-500/50'
            }`}
          >
            <Flame className="w-4 h-4 text-rose-400" />
            <div className="text-left">
              <div className="leading-none flex items-center gap-1">
                <span>Visión Térmica</span>
                <span className="text-[9px] text-amber-300 font-mono">LASER</span>
              </div>
              <div className="text-[10px] opacity-75 font-mono">R / 1</div>
            </div>
          </button>

          {/* 2. Freeze Breath */}
          <button
            onClick={() => onSelectPower('freeze-breath')}
            className={`flex items-center gap-2.5 px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
              activePower === 'freeze-breath'
                ? 'bg-sky-600 text-white border-sky-400 shadow-lg shadow-sky-900/50'
                : 'bg-slate-900 text-slate-300 border-slate-700/60 hover:border-sky-500/50'
            }`}
          >
            <Snowflake className="w-4 h-4 text-sky-400" />
            <div className="text-left">
              <div className="leading-none">Aliento Gélido</div>
              <div className="text-[10px] opacity-75 font-mono">2 / Tecla E</div>
            </div>
          </button>

          {/* 3. Grab/Throw Vehicle & Ground Slam */}
          <button
            onClick={() => onSelectPower('ground-slam')}
            className={`flex items-center gap-2.5 px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
              isHoldingObject
                ? 'bg-amber-500 text-slate-950 border-amber-300 shadow-lg shadow-amber-500/50 animate-pulse'
                : activePower === 'ground-slam'
                ? 'bg-amber-600 text-white border-amber-400 shadow-lg shadow-amber-900/50'
                : 'bg-slate-900 text-slate-300 border-slate-700/60 hover:border-amber-500/50'
            }`}
          >
            <Zap className="w-4 h-4 text-amber-400" />
            <div className="text-left">
              <div className="leading-none">{isHoldingObject ? '¡Lanzar Coche!' : 'Agarrar / Sísmico'}</div>
              <div className="text-[10px] opacity-75 font-mono">Tecla F / Clic</div>
            </div>
          </button>

          {/* 4. Target Lock-On */}
          <div
            className={`flex items-center gap-2.5 px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
              hasLockedTarget
                ? 'bg-rose-600/30 text-rose-300 border-rose-500'
                : 'bg-slate-900 text-slate-400 border-slate-700/60'
            }`}
          >
            <Shield className="w-4 h-4 text-rose-400" />
            <div className="text-left">
              <div className="leading-none">Fijar Blanco 3D</div>
              <div className="text-[10px] opacity-75 font-mono">Tecla Q / Tab</div>
            </div>
          </div>

          {/* 5. X-Ray Vision */}
          <button
            onClick={() => onSelectPower('x-ray')}
            className={`flex items-center gap-2.5 px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
              xrayActive
                ? 'bg-emerald-600 text-white border-emerald-400 shadow-lg shadow-emerald-900/50'
                : 'bg-slate-900 text-slate-300 border-slate-700/60 hover:border-emerald-500/50'
            }`}
          >
            <Eye className="w-4 h-4 text-emerald-400" />
            <div className="text-left">
              <div className="leading-none">Rayos X</div>
              <div className="text-[10px] opacity-75 font-mono">4 / Tecla X</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
