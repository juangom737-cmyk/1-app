import React, { useEffect, useRef, useState } from 'react';
import { CityBuilding, Mission, TrafficCar } from '../types/game';
import { MapPin, ChevronDown, ChevronUp, Compass } from 'lucide-react';

interface MinimapProps {
  playerX: number;
  playerZ: number;
  playerRotationY: number;
  buildings: CityBuilding[];
  activeMission: Mission | null;
  trafficCars: TrafficCar[];
  altMeters: number;
}

export const Minimap: React.FC<MinimapProps> = ({
  playerX,
  playerZ,
  playerRotationY,
  buildings,
  activeMission,
  trafficCars,
  altMeters,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = 180;
    const center = size / 2;
    const radius = size / 2 - 4;
    // Dynamic orbital zoom: zooms out smoothly as Superman ascends toward outer space
    const isOrbit = altMeters > 500;
    const zoom = isOrbit
      ? Math.max(0.065, 0.52 * (350 / Math.max(350, altMeters * 0.9)))
      : Math.max(0.25, 0.52 - Math.max(0, altMeters - 120) * 0.0006);

    ctx.clearRect(0, 0, size, size);

    // Circular Clip
    ctx.save();
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.clip();

    // Background Map Texture
    ctx.fillStyle = isOrbit ? '#020617' : '#0f172a';
    ctx.fillRect(0, 0, size, size);

    // Apply rotation so the map aligns with Superman's forward direction
    ctx.save();
    ctx.translate(center, center);
    ctx.rotate(playerRotationY);

    // Draw West River / Bayside Water
    const riverLeft = (-1200 - playerX) * zoom;
    const riverWidth = (800) * zoom;
    ctx.fillStyle = '#0369a1';
    ctx.fillRect(riverLeft, (-1200 - playerZ) * zoom, riverWidth, 2400 * zoom);

    // Draw grid streets across quadrupled territory
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1.2;
    for (let i = -840; i <= 840; i += 70) {
      // vertical roads
      ctx.beginPath();
      ctx.moveTo((i - playerX) * zoom, (-840 - playerZ) * zoom);
      ctx.lineTo((i - playerX) * zoom, (840 - playerZ) * zoom);
      ctx.stroke();

      // horizontal roads
      ctx.beginPath();
      ctx.moveTo((-840 - playerX) * zoom, (i - playerZ) * zoom);
      ctx.lineTo((840 - playerX) * zoom, (i - playerZ) * zoom);
      ctx.stroke();
    }

    // Draw Buildings
    for (const b of buildings) {
      const bx = (b.x - playerX) * zoom;
      const bz = (b.z - playerZ) * zoom;
      const bw = b.width * zoom;
      const bd = b.depth * zoom;

      // Color coding
      if (b.name === 'Daily Planet') {
        ctx.fillStyle = '#38bdf8';
      } else if (b.name === 'LexCorp Tower') {
        ctx.fillStyle = '#06b6d4';
      } else if (b.isIconic) {
        ctx.fillStyle = b.color || '#94a3b8';
      } else {
        ctx.fillStyle = '#1e293b';
      }

      ctx.fillRect(bx - bw / 2, bz - bd / 2, bw, bd);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 0.8;
      ctx.strokeRect(bx - bw / 2, bz - bd / 2, bw, bd);
    }

    // Draw Traffic Cars
    for (const car of trafficCars) {
      const cx = (car.x - playerX) * zoom;
      const cz = (car.z - playerZ) * zoom;
      if (Math.hypot(cx, cz) < radius + 10) {
        ctx.fillStyle = car.type === 'police' ? '#3b82f6' : car.type === 'taxi' ? '#eab308' : '#e2e8f0';
        ctx.beginPath();
        ctx.arc(cx, cz, 2.0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Draw Mission Objective Blip
    if (activeMission) {
      const mx = (activeMission.x - playerX) * zoom;
      const mz = (activeMission.z - playerZ) * zoom;
      const distFromCenter = Math.hypot(mx, mz);

      // Clamp to radar perimeter if off-screen
      let drawX = mx;
      let drawZ = mz;
      const isClamped = distFromCenter > radius - 12;

      if (isClamped) {
        const angle = Math.atan2(mz, mx);
        drawX = Math.cos(angle) * (radius - 12);
        drawZ = Math.sin(angle) * (radius - 12);
      }

      // Pulsing mission icon
      const pulse = 1.0 + Math.sin(Date.now() * 0.008) * 0.25;
      ctx.fillStyle = activeMission.iconColor || '#ef4444';
      ctx.beginPath();
      // Diamond
      ctx.moveTo(drawX, drawZ - 6 * pulse);
      ctx.lineTo(drawX + 6 * pulse, drawZ);
      ctx.lineTo(drawX, drawZ + 6 * pulse);
      ctx.lineTo(drawX - 6 * pulse, drawZ);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    ctx.restore(); // Undo map rotation

    // Draw Player Icon (Static pointing Up in center)
    ctx.fillStyle = '#dc2626'; // Superman Red
    ctx.beginPath();
    ctx.moveTo(center, center - 7);
    ctx.lineTo(center + 5, center + 6);
    ctx.lineTo(center, center + 3);
    ctx.lineTo(center - 5, center + 6);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#facc15'; // Gold rim
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.restore(); // End Circular Clip

    // Circular Radar Bezel
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.stroke();

    // Radar crosshairs
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(center, 4);
    ctx.lineTo(center, size - 4);
    ctx.moveTo(4, center);
    ctx.lineTo(size - 4, center);
    ctx.stroke();

    // North Marker 'N'
    const northAngle = -playerRotationY;
    const nx = center + Math.sin(northAngle) * (radius - 10);
    const ny = center - Math.cos(northAngle) * (radius - 10);
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('N', nx, ny);
  }, [playerX, playerZ, playerRotationY, buildings, activeMission, trafficCars]);

  const missionDist = activeMission
    ? Math.round(Math.hypot(activeMission.x - playerX, activeMission.z - playerZ))
    : 0;

  return (
    <div className="relative flex flex-col items-end gap-1.5 transition-all">
      {isCollapsed ? (
        /* Ultra-compact collapsed badge */
        <button
          onClick={() => setIsCollapsed(false)}
          className="flex items-center gap-2 px-3 py-1.5 bg-slate-950/90 hover:bg-slate-900 backdrop-blur-md rounded-xl border border-sky-500/40 shadow-xl text-sky-400 hover:text-white transition-all cursor-pointer group"
          title="Abrir Radar de Metrópolis"
        >
          <Compass className="w-3.5 h-3.5 text-sky-400 animate-spin-slow" />
          <span className="text-[11px] font-bold font-hud tracking-wider uppercase">RADAR</span>
          <span className="text-[10px] font-mono text-slate-400 border-l border-slate-700 pl-1.5">
            {altMeters > 500 ? `ÓRBITA ${Math.round(altMeters)}m` : `${Math.round(altMeters)}m`}
          </span>
          <span className="text-[10px] text-sky-300 font-bold group-hover:translate-y-[-1px] transition-transform">
            [+]
          </span>
        </button>
      ) : (
        /* Expanded Radar View */
        <div className="flex flex-col items-end gap-1.5 p-2 bg-slate-950/90 backdrop-blur-md rounded-2xl border border-sky-500/40 shadow-2xl transition-all animate-in fade-in zoom-in-95 duration-150">
          {/* Header bar with toggle */}
          <div className="w-full flex items-center justify-between px-1.5 py-0.5 text-xs">
            <div className="flex items-center gap-1.5 text-sky-400 font-bold font-hud">
              <Compass className="w-3.5 h-3.5 text-sky-400 animate-spin-slow" />
              <span className="text-[11px] tracking-wider uppercase">RADAR METRÓPOLIS</span>
            </div>
            <button
              onClick={() => setIsCollapsed(true)}
              className="px-1.5 py-0.5 text-[10px] font-semibold rounded-md bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors flex items-center gap-1"
              title="Minimizar Radar"
            >
              <span>Minimizar</span>
              <ChevronUp className="w-3 h-3" />
            </button>
          </div>

          <div className="relative">
            <canvas
              ref={canvasRef}
              width={180}
              height={180}
              className="rounded-full shadow-inner border border-sky-400/20"
            />
            {/* Altitude indicator */}
            <div
              className={`absolute bottom-1 right-1 text-[10px] font-hud px-1.5 py-0.5 rounded border ${
                altMeters > 500
                  ? 'text-amber-400 bg-amber-950/90 border-amber-400/40 animate-pulse'
                  : 'text-sky-400 bg-slate-900/90 border-sky-500/30'
              }`}
            >
              {altMeters > 500 ? `ÓRBITA ${Math.round(altMeters)}m` : `ALT ${Math.round(altMeters)}m`}
            </div>
          </div>

          {activeMission && (
            <div className="w-[180px] px-1 text-xs">
              <div className="flex items-center justify-between text-slate-300">
                <span className="font-semibold text-rose-400 truncate max-w-[110px]">
                  {activeMission.title}
                </span>
                <span className="font-mono tabular-nums text-slate-400 font-hud text-[11px]">
                  {missionDist}m
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
