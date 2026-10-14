import React, { useEffect, useRef, useState } from 'react';
import { CityBuilding, EnemyEntity, Mission, TrafficCar } from '../types/game';
import { ChevronUp, Compass } from 'lucide-react';

interface MinimapProps {
  playerX: number;
  playerZ: number;
  playerRotationY: number;
  buildings: CityBuilding[];
  activeMission: Mission | null;
  trafficCars: TrafficCar[];
  activeEnemies?: EnemyEntity[];
  altMeters: number;
}

export const Minimap: React.FC<MinimapProps> = ({
  playerX,
  playerZ,
  playerRotationY,
  buildings,
  activeMission,
  trafficCars,
  activeEnemies = [],
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

    // Streets, the red TransMilenio corridor, the western river and the
    // unmistakable green silhouette of the eastern hills.
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1.2;
    for (let i = -840; i <= 840; i += 70) {
      ctx.beginPath();
      ctx.moveTo((i - playerX) * zoom, (-840 - playerZ) * zoom);
      ctx.lineTo((i - playerX) * zoom, (840 - playerZ) * zoom);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo((-840 - playerX) * zoom, (i - playerZ) * zoom);
      ctx.lineTo((840 - playerX) * zoom, (i - playerZ) * zoom);
      ctx.stroke();
    }

    ctx.save();
    ctx.fillStyle = '#345640';
    ctx.beginPath();
    const cerros = [
      [640, -840], [760, -700], [720, -560], [850, -390], [735, -220],
      [825, -70], [720, 80], [850, 260], [730, 440], [820, 640], [700, 840],
      [1200, 840], [1200, -840],
    ];
    cerros.forEach(([worldX, worldZ], index) => {
      const px = (worldX - playerX) * zoom;
      const pz = (worldZ - playerZ) * zoom;
      if (index === 0) ctx.moveTo(px, pz);
      else ctx.lineTo(px, pz);
    });
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(134, 185, 124, 0.34)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo((720 - playerX) * zoom, (-840 - playerZ) * zoom);
    ctx.lineTo((880 - playerX) * zoom, (-500 - playerZ) * zoom);
    ctx.lineTo((770 - playerX) * zoom, (-180 - playerZ) * zoom);
    ctx.lineTo((900 - playerX) * zoom, (140 - playerZ) * zoom);
    ctx.lineTo((760 - playerX) * zoom, (520 - playerZ) * zoom);
    ctx.stroke();

    ctx.fillStyle = '#226044';
    ctx.fillRect((-345 - playerX) * zoom, (-505 - playerZ) * zoom, 190 * zoom, 170 * zoom);
    ctx.restore();

    // Red exclusive bus lanes identify the Carrera 10 / TransMilenio corridor.
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.72)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo((84 - playerX) * zoom, (-760 - playerZ) * zoom);
    ctx.lineTo((84 - playerX) * zoom, (760 - playerZ) * zoom);
    ctx.moveTo((96 - playerX) * zoom, (-760 - playerZ) * zoom);
    ctx.lineTo((96 - playerX) * zoom, (760 - playerZ) * zoom);
    ctx.stroke();

    // Draw Buildings
    for (const b of buildings) {
      const bx = (b.x - playerX) * zoom;
      const bz = (b.z - playerZ) * zoom;
      const bw = b.width * zoom;
      const bd = b.depth * zoom;

      if (b.name?.includes('Capitolio') || b.name?.includes('Bolívar')) {
        ctx.fillStyle = '#facc15';
      } else if (b.name?.includes('Colpatria')) {
        ctx.fillStyle = '#ef4444';
      } else if (b.name?.includes('Monserrate') || b.name?.includes('Guadalupe')) {
        ctx.fillStyle = '#86efac';
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
        ctx.fillStyle =
          car.type === 'police'
            ? '#3b82f6'
            : car.type === 'taxi'
            ? '#eab308'
            : car.type === 'transmilenio'
            ? '#ef4444'
            : '#e2e8f0';
        ctx.beginPath();
        ctx.arc(cx, cz, 2.0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Draw Active Enemies (Red/Orange Hostile Blips)
    for (const enemy of activeEnemies) {
      if (!enemy.active || enemy.health <= 0) continue;
      const ex = (enemy.x - playerX) * zoom;
      const ez = (enemy.z - playerZ) * zoom;
      if (Math.hypot(ex, ez) < radius - 4) {
        ctx.fillStyle = enemy.frozen
          ? '#38bdf8'
          : enemy.type === 'fire'
          ? '#f97316'
          : '#f43f5e';
        ctx.beginPath();
        ctx.arc(ex, ez, 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
    }

    // Draw Mission Objective Blip
    if (activeMission) {
      const mx = (activeMission.x - playerX) * zoom;
      const mz = (activeMission.z - playerZ) * zoom;
      const distFromCenter = Math.hypot(mx, mz);

      let drawX = mx;
      let drawZ = mz;
      const isClamped = distFromCenter > radius - 12;

      if (isClamped) {
        const angle = Math.atan2(mz, mx);
        drawX = Math.cos(angle) * (radius - 12);
        drawZ = Math.sin(angle) * (radius - 12);
      }

      const pulse = 1.0 + Math.sin(Date.now() * 0.008) * 0.25;
      ctx.fillStyle = activeMission.iconColor || '#ef4444';
      ctx.beginPath();
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
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.moveTo(center, center - 7);
    ctx.lineTo(center + 5, center + 6);
    ctx.lineTo(center, center + 3);
    ctx.lineTo(center - 5, center + 6);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#facc15';
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
    const northAngle = playerRotationY;
    const nx = center + Math.sin(northAngle) * (radius - 10);
    const ny = center - Math.cos(northAngle) * (radius - 10);
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('N', nx, ny);
  }, [playerX, playerZ, playerRotationY, buildings, activeMission, trafficCars, activeEnemies, altMeters]);

  const missionDist = activeMission
    ? Math.round(Math.hypot(activeMission.x - playerX, activeMission.z - playerZ))
    : 0;
  const districtName = altMeters > 500
    ? 'SOBREVOLANDO BOGOTÁ'
    : playerX > 660
    ? 'CERROS ORIENTALES'
    : playerX < -660
    ? 'AEROPUERTO EL DORADO'
    : playerZ < -320 && playerX > 100
    ? 'EL CAMPÍN · TEUSAQUILLO'
    : playerZ < -320
    ? 'PARQUE SIMÓN BOLÍVAR'
    : playerZ < -100
    ? 'CENTRO INTERNACIONAL'
    : playerZ > 320
    ? 'BOGOTÁ SUR'
    : playerX < -150
    ? 'LA CANDELARIA'
    : 'PLAZA DE BOLÍVAR';

  return (
    <div className="relative flex flex-col items-end gap-1.5 transition-all">
      {isCollapsed ? (
        /* Ultra-compact collapsed badge */
        <button
          onClick={() => setIsCollapsed(false)}
          className="flex items-center gap-2 px-3 py-1.5 bg-slate-950/90 hover:bg-slate-900 backdrop-blur-md rounded-xl border border-sky-500/40 shadow-xl text-sky-400 hover:text-white transition-all cursor-pointer group"
          title="Abrir el mapa de Bogotá"
        >
          <Compass className="w-3.5 h-3.5 text-sky-400 animate-spin-slow" />
          <span className="text-[11px] font-bold font-hud tracking-wider uppercase">BOGOTÁ</span>
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
              <span className="text-[11px] tracking-wider uppercase">BOGOTÁ // RADAR</span>
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

          <div className="w-[180px] flex items-center px-1 text-[9px] font-bold tracking-wider text-emerald-300 uppercase">
            <span>{districtName}</span>
          </div>

          {activeMission && (
            <div className="w-[180px] px-1 text-xs">
              <div className="flex items-center justify-between text-slate-300">
                <span className="font-semibold text-rose-400 truncate max-w-[115px]">
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
