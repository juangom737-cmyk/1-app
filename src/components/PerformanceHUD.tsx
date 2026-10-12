import React from 'react';
import { GraphicQualityProfile, PerformanceMetrics } from '../types/game';
import { Activity, Cpu, Gauge, Zap, Monitor, Layers } from 'lucide-react';

interface PerformanceHUDProps {
  metrics: PerformanceMetrics;
  onSelectProfile: (profile: GraphicQualityProfile) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export const PerformanceHUD: React.FC<PerformanceHUDProps> = ({
  metrics,
  onSelectProfile,
  isOpen,
  onToggle,
}) => {
  const is60Fps = metrics.fps >= 55;
  const is30Fps = metrics.fps >= 28 && metrics.fps < 55;

  return (
    <div className="fixed top-4 left-4 z-50 pointer-events-auto font-mono text-xs select-none">
      {/* Minimized Pill Toggle */}
      {!isOpen ? (
        <button
          onClick={onToggle}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/85 backdrop-blur-md border border-slate-700/80 shadow-2xl hover:border-sky-400 text-slate-200 hover:text-white transition-all cursor-pointer group"
          title="Abrir Panel de Rendimiento 60 FPS"
        >
          <div
            className={`w-2.5 h-2.5 rounded-full ${
              is60Fps
                ? 'bg-emerald-400 animate-pulse'
                : is30Fps
                ? 'bg-amber-400 animate-pulse'
                : 'bg-rose-500 animate-ping'
            }`}
          />
          <span className="font-bold font-hud text-[11px] tracking-wider text-slate-300 group-hover:text-sky-300">
            {Math.round(metrics.fps)} FPS
          </span>
          <span className="text-[10px] text-slate-400 opacity-75">
            {metrics.frameTimeMs.toFixed(1)}ms
          </span>
          <Activity className="w-3.5 h-3.5 text-sky-400 ml-0.5" />
        </button>
      ) : (
        /* Expanded Profiler Card */
        <div className="w-80 p-4 rounded-2xl bg-slate-950/92 backdrop-blur-xl border border-sky-500/40 shadow-2xl space-y-3.5 animate-in fade-in duration-150">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-sky-400 animate-pulse" />
              <span className="font-bold text-white text-[11px] tracking-widest font-hud uppercase">
                OPERACIÓN 60 FPS · PROFILER
              </span>
            </div>
            <button
              onClick={onToggle}
              className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[10px] transition-colors"
            >
              Cerrar
            </button>
          </div>

          {/* Metric Dashboard */}
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            {/* FPS Current & Average */}
            <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Gauge className="w-3 h-3 text-sky-400" /> Cuadros/Seg
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span
                  className={`text-xl font-bold font-hud ${
                    is60Fps ? 'text-emerald-400' : is30Fps ? 'text-amber-400' : 'text-rose-400'
                  }`}
                >
                  {Math.round(metrics.fps)}
                </span>
                <span className="text-[10px] text-slate-400">
                  (Avg: {Math.round(metrics.avgFps)} | Min: {Math.round(metrics.minFps)})
                </span>
              </div>
            </div>

            {/* Frame Time (Mean & P95) */}
            <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Cpu className="w-3 h-3 text-amber-400" /> Latencia Frame
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span
                  className={`text-base font-bold font-hud ${
                    metrics.frameTimeMs <= 16.7
                      ? 'text-emerald-400'
                      : metrics.frameTimeMs <= 33.3
                      ? 'text-amber-400'
                      : 'text-rose-400'
                  }`}
                >
                  {metrics.frameTimeMs.toFixed(1)}ms
                </span>
                <span className="text-[10px] text-slate-400">
                  P95: {metrics.p95FrameTimeMs.toFixed(1)}ms
                </span>
              </div>
            </div>

            {/* Draw Calls */}
            <div className="p-2 rounded-xl bg-slate-900/70 border border-slate-800/80">
              <span className="text-[10px] text-slate-400 block flex items-center gap-1">
                <Layers className="w-3 h-3 text-purple-400" /> Draw Calls
              </span>
              <span className="text-sm font-bold text-sky-300 font-hud">
                {metrics.drawCalls}
              </span>
            </div>

            {/* Triangles */}
            <div className="p-2 rounded-xl bg-slate-900/70 border border-slate-800/80">
              <span className="text-[10px] text-slate-400 block flex items-center gap-1">
                <Monitor className="w-3 h-3 text-indigo-400" /> Triángulos
              </span>
              <span className="text-sm font-bold text-sky-300 font-hud">
                {(metrics.triangles / 1000).toFixed(1)}k
              </span>
            </div>
          </div>

          {/* Graphics Quality Profiles */}
          <div className="space-y-1.5 pt-1 border-t border-slate-800/80">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Zap className="w-3 h-3 text-amber-400" /> Perfiles de Rendimiento
            </span>

            <div className="grid grid-cols-1 gap-1.5">
              {/* Profile 1: AAA OPTIMIZADO — RADEON (Target 60 FPS) */}
              <button
                onClick={() => onSelectProfile('radeon-optimized')}
                className={`p-2 rounded-xl border text-left transition-all flex items-center justify-between ${
                  metrics.activeProfile === 'radeon-optimized'
                    ? 'bg-amber-500/20 border-amber-400 text-white shadow-lg shadow-amber-500/10'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="font-bold text-amber-300 flex items-center gap-1.5 text-[11px]">
                    <span>AAA OPTIMIZADO — RADEON</span>
                    <span className="text-[9px] px-1 py-0.2 rounded bg-amber-950 text-amber-300 border border-amber-600 font-sans">
                      60 FPS
                    </span>
                  </div>
                  <div className="text-[9px] text-slate-400 mt-0.5">
                    Pixel ratio 1.0 · Sombras 1024 · Instancing · Culling agresivo
                  </div>
                </div>
                {metrics.activeProfile === 'radeon-optimized' && (
                  <div className="w-2 h-2 rounded-full bg-amber-400 animate-ping mr-1" />
                )}
              </button>

              {/* Profile 2: EQUILIBRADO (30 FPS SÓLIDO) */}
              <button
                onClick={() => onSelectProfile('balanced-30')}
                className={`p-2 rounded-xl border text-left transition-all flex items-center justify-between ${
                  metrics.activeProfile === 'balanced-30'
                    ? 'bg-sky-500/20 border-sky-400 text-white shadow-lg shadow-sky-500/10'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="font-bold text-sky-300 flex items-center gap-1.5 text-[11px]">
                    <span>EQUILIBRADO — 30 FPS</span>
                    <span className="text-[9px] px-1 py-0.2 rounded bg-sky-950 text-sky-300 border border-sky-600 font-sans">
                      FLEX
                    </span>
                  </div>
                  <div className="text-[9px] text-slate-400 mt-0.5">
                    Pixel ratio 0.85 · Post-pro ligero · Sombra solar reducida
                  </div>
                </div>
                {metrics.activeProfile === 'balanced-30' && (
                  <div className="w-2 h-2 rounded-full bg-sky-400 animate-ping mr-1" />
                )}
              </button>

              {/* Profile 3: ULTRA FIDELIDAD */}
              <button
                onClick={() => onSelectProfile('ultra-fidelity')}
                className={`p-2 rounded-xl border text-left transition-all flex items-center justify-between ${
                  metrics.activeProfile === 'ultra-fidelity'
                    ? 'bg-purple-500/20 border-purple-400 text-white shadow-lg shadow-purple-500/10'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="font-bold text-purple-300 flex items-center gap-1.5 text-[11px]">
                    <span>ULTRA FIDELIDAD</span>
                    <span className="text-[9px] px-1 py-0.2 rounded bg-purple-950 text-purple-300 border border-purple-600 font-sans">
                      MAX
                    </span>
                  </div>
                  <div className="text-[9px] text-slate-400 mt-0.5">
                    Pixel ratio nativo · Sombras 2048 · Bloom completo
                  </div>
                </div>
                {metrics.activeProfile === 'ultra-fidelity' && (
                  <div className="w-2 h-2 rounded-full bg-purple-400 animate-ping mr-1" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
