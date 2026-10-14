import React, { useRef } from 'react';
import { PowerType } from '../types/game';
import { Flame, Snowflake, Zap, Eye, ArrowUp, ArrowDown, FastForward } from 'lucide-react';

interface TouchControlsProps {
  onMove: (dx: number, dz: number) => void;
  onAscend: (active: boolean) => void;
  onDescend: (active: boolean) => void;
  onSupersonic: (active: boolean) => void;
  onTriggerPower: (power: PowerType) => void;
  onReleasePower: () => void;
  onToggleFlight: () => void;
  onTriggerPunch?: () => void;
  onTriggerGrabOrSlam?: () => void;
  onTriggerLockOn?: () => void;
  isFlying: boolean;
  isSupersonic: boolean;
  isHoldingObject?: boolean;
  hasLockedTarget?: boolean;
  activePower: PowerType | null;
}

export const TouchControls: React.FC<TouchControlsProps> = ({
  onMove,
  onAscend,
  onDescend,
  onSupersonic,
  onTriggerPower,
  onReleasePower,
  onToggleFlight,
  onTriggerPunch,
  onTriggerGrabOrSlam,
  onTriggerLockOn,
  isFlying,
  isSupersonic,
  isHoldingObject = false,
  hasLockedTarget = false,
  activePower,
}) => {
  const joystickRef = useRef<HTMLDivElement | null>(null);
  const touchIdRef = useRef<number | null>(null);
  const startPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0];
    touchIdRef.current = touch.identifier;
    startPosRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    for (let i = 0; i < e.touches.length; i++) {
      const touch = e.touches[i];
      if (touch.identifier === touchIdRef.current) {
        const dx = touch.clientX - startPosRef.current.x;
        const dy = touch.clientY - startPosRef.current.y;
        const dist = Math.hypot(dx, dy);
        const maxDist = 45;
        const clampedDist = Math.min(dist, maxDist);
        const angle = Math.atan2(dy, dx);

        const normX = (Math.cos(angle) * clampedDist) / maxDist;
        const normZ = (Math.sin(angle) * clampedDist) / maxDist;
        onMove(normX, normZ);
        break;
      }
    }
  };

  const handleTouchEnd = () => {
    touchIdRef.current = null;
    onMove(0, 0);
  };

  return (
    <div className="absolute inset-0 pointer-events-none select-none z-20 flex justify-between items-end p-4 md:hidden">
      {/* Left: Virtual Joystick */}
      <div
        ref={joystickRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        className="pointer-events-auto w-32 h-32 rounded-full bg-slate-900/60 backdrop-blur-md border border-white/20 flex items-center justify-center active:bg-slate-900/80 touch-none shadow-xl"
      >
        <div className="w-14 h-14 rounded-full bg-sky-500/80 shadow-lg border border-sky-300 flex items-center justify-center text-white text-xs font-bold">
          DIR
        </div>
      </div>

      {/* Right: Action Buttons */}
      <div className="pointer-events-auto flex flex-col gap-2.5 items-end">
        {/* Top row: Flight controls */}
        <div className="flex gap-2">
          <button
            onTouchStart={() => onAscend(true)}
            onTouchEnd={() => onAscend(false)}
            onMouseDown={() => onAscend(true)}
            onMouseUp={() => onAscend(false)}
            className="w-12 h-12 rounded-xl bg-sky-600/80 active:bg-sky-500 text-white flex flex-col items-center justify-center shadow-lg border border-sky-400/40"
            title="Ascender / Subir"
          >
            <ArrowUp className="w-5 h-5" />
            <span className="text-[8px] font-bold">SUBIR</span>
          </button>

          <button
            onTouchStart={() => onDescend(true)}
            onTouchEnd={() => onDescend(false)}
            onMouseDown={() => onDescend(true)}
            onMouseUp={() => onDescend(false)}
            className="w-12 h-12 rounded-xl bg-cyan-700/80 active:bg-cyan-600 text-white flex flex-col items-center justify-center shadow-lg border border-cyan-400/40"
            title="Descender / Bajar"
          >
            <ArrowDown className="w-5 h-5" />
            <span className="text-[8px] font-bold">BAJAR</span>
          </button>

          <button
            onClick={onToggleFlight}
            className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-lg border text-xs font-bold transition-colors ${
              isFlying
                ? 'bg-amber-600 active:bg-amber-500 text-white border-amber-400'
                : 'bg-slate-800 active:bg-slate-700 text-slate-200 border-white/20'
            }`}
            title="Alternar Vuelo"
          >
            {isFlying ? 'VOLAR' : 'CAMINAR'}
          </button>

          <button
            onTouchStart={() => onSupersonic(true)}
            onTouchEnd={() => onSupersonic(false)}
            className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-lg border transition-colors ${
              isSupersonic
                ? 'bg-rose-600 active:bg-rose-500 text-white border-rose-400 animate-pulse'
                : 'bg-slate-800 active:bg-slate-700 text-slate-200 border-white/20'
            }`}
            title="Supersónico Mach"
          >
            <FastForward className="w-6 h-6" />
          </button>
        </div>

        {/* Combat actions row */}
        {(onTriggerPunch || onTriggerGrabOrSlam || onTriggerLockOn) && (
          <div className="flex gap-2">
            {onTriggerPunch && (
              <button
                onClick={onTriggerPunch}
                className="px-3 py-2 rounded-xl bg-amber-500/90 active:bg-amber-400 text-slate-950 font-extrabold text-[10px] shadow-lg border border-amber-300"
                title="Golpe Kriptoniano"
              >
                PUÑETAZO
              </button>
            )}
            {onTriggerGrabOrSlam && (
              <button
                onClick={onTriggerGrabOrSlam}
                className={`px-3 py-2 rounded-xl font-extrabold text-[10px] shadow-lg border transition-colors ${
                  isHoldingObject
                    ? 'bg-rose-600 text-white border-rose-300 animate-pulse'
                    : 'bg-slate-800 text-amber-300 border-amber-500/40'
                }`}
                title="Agarrar / Lanzar Vehículo"
              >
                {isHoldingObject ? 'LANZAR' : 'AGARRAR'}
              </button>
            )}
            {onTriggerLockOn && (
              <button
                onClick={onTriggerLockOn}
                className={`px-3 py-2 rounded-xl font-extrabold text-[10px] shadow-lg border transition-colors ${
                  hasLockedTarget
                    ? 'bg-rose-600 text-white border-rose-300 animate-pulse'
                    : 'bg-slate-800 text-slate-300 border-white/20'
                }`}
                title="Fijar Blanco"
              >
                BLANCO
              </button>
            )}
          </div>
        )}

        {/* Superpowers cluster */}
        <div className="grid grid-cols-2 gap-2">
          {/* Heat Vision */}
          <button
            onTouchStart={() => onTriggerPower('heat-vision')}
            onTouchEnd={onReleasePower}
            onMouseDown={() => onTriggerPower('heat-vision')}
            onMouseUp={onReleasePower}
            className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center shadow-lg border transition-colors ${
              activePower === 'heat-vision'
                ? 'bg-rose-600 text-white border-rose-300'
                : 'bg-rose-950/80 text-rose-300 border-rose-700/50'
            }`}
          >
            <Flame className="w-5 h-5" />
            <span className="text-[9px] font-bold mt-0.5">LÁSER</span>
          </button>

          {/* Freeze Breath */}
          <button
            onTouchStart={() => onTriggerPower('freeze-breath')}
            onTouchEnd={onReleasePower}
            onMouseDown={() => onTriggerPower('freeze-breath')}
            onMouseUp={onReleasePower}
            className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center shadow-lg border transition-colors ${
              activePower === 'freeze-breath'
                ? 'bg-sky-500 text-white border-sky-300'
                : 'bg-sky-950/80 text-sky-300 border-sky-700/50'
            }`}
          >
            <Snowflake className="w-5 h-5" />
            <span className="text-[9px] font-bold mt-0.5">HIELO</span>
          </button>

          {/* Ground Slam */}
          <button
            onClick={() => onTriggerPower('ground-slam')}
            className="w-14 h-14 rounded-2xl bg-amber-950/80 active:bg-amber-600 text-amber-300 border border-amber-700/50 flex flex-col items-center justify-center shadow-lg"
          >
            <Zap className="w-5 h-5" />
            <span className="text-[9px] font-bold mt-0.5">GOLPE</span>
          </button>

          {/* X-Ray Vision */}
          <button
            onClick={() => onTriggerPower('x-ray')}
            className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center shadow-lg border transition-colors ${
              activePower === 'x-ray'
                ? 'bg-emerald-500 text-white border-emerald-300'
                : 'bg-emerald-950/80 text-emerald-300 border-emerald-700/50'
            }`}
          >
            <Eye className="w-5 h-5" />
            <span className="text-[9px] font-bold mt-0.5">RAYOS X</span>
          </button>
        </div>
      </div>
    </div>
  );
};
