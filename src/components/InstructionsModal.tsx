import React from 'react';
import { X, Flame, Snowflake, Zap, Eye, Compass, Shield, Wind } from 'lucide-react';

interface InstructionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InstructionsModal: React.FC<InstructionsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-rose-500 animate-pulse" />
            <h2 className="text-lg font-bold tracking-tight text-white font-hud">
              METROPOLIS 3D // MANUAL DE SUPERHÉROE
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-300">
          {/* Controls Table */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-sky-400 mb-3 flex items-center gap-2">
              <Compass className="w-4 h-4" /> Controles de PC (Teclado y Ratón)
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              <div className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/50">
                <span className="font-bold text-white block">Clic Izquierdo</span>
                <span className="text-amber-400 font-medium">Golpes & Romper Estatuas de Hielo</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/50">
                <span className="font-bold text-white block">Clic Der / Doble W</span>
                <span className="text-sky-300 font-medium">Supersónico Instantáneo (Boom Mach)</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/50">
                <span className="font-bold text-white block">Correr hacia Edificio</span>
                <span className="text-emerald-300 font-medium">Carrera Vertical & Salto de Azotea</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/50">
                <span className="font-bold text-white block">Tecla E / 2</span>
                <span className="text-sky-400 font-medium">Aliento Gélido (Congela en Estatuas)</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/50">
                <span className="font-bold text-white block">Tecla R / 1</span>
                <span className="text-rose-400 font-medium">Visión Térmica (Láser de plasma)</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/50">
                <span className="font-bold text-white block">Tecla F</span>
                <span className="text-orange-400 font-medium">Agarrar / Lanzar Vehículos & Rivales</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/50">
                <span className="font-bold text-white block">Tecla Tab / Q</span>
                <span className="text-red-400 font-medium">Fijación de Blanco Aéreo (Lock-On)</span>
              </div>
            </div>
          </div>

          {/* Superpowers Guide */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-3 flex items-center gap-2">
              <Shield className="w-4 h-4" /> Arsenal de Combate y Superpoderes AAA
            </h3>
            <div className="space-y-2.5">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-950/20 border border-amber-900/40">
                <div className="p-2 rounded-lg bg-amber-600/20 text-amber-400 shrink-0">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">Súper Fuerza & Romper Estatuas de Hielo</span>
                    <span className="text-[11px] text-amber-400 font-mono">Clic Izquierdo</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Combo de 3 golpes demoledores. Destruye utilería urbana y hace estallar enemigos congelados en fragmentos de hielo con un sonido demoledor y puntos extra.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-sky-950/20 border border-sky-900/40">
                <div className="p-2 rounded-lg bg-sky-600/20 text-sky-400 shrink-0">
                  <Snowflake className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">Aliento Gélido Cristalizador</span>
                    <span className="text-[11px] text-sky-400 font-mono">Tecla E / Tecla 2</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Vórtice criogénico que encierra a los asaltantes, drones y vehículos en estatuas de hielo sólido rompibles con puñetazos.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-emerald-950/20 border border-emerald-900/40">
                <div className="p-2 rounded-lg bg-emerald-600/20 text-emerald-400 shrink-0">
                  <Wind className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">Carrera por Muros y Catapultado de Azoteas (Spider-Man)</span>
                    <span className="text-[11px] text-emerald-400 font-mono">W contra Fachadas</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Corre a supervelocidad directamente por la fachada de cualquier rascacielos. Al llegar al borde de la azotea, te catapulta en un salto acrobático hacia las nubes.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-rose-950/20 border border-rose-900/40">
                <div className="p-2 rounded-lg bg-rose-600/20 text-rose-400 shrink-0">
                  <Flame className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">Visión Térmica Hiperconcentrada</span>
                    <span className="text-[11px] text-rose-400 font-mono">Tecla R / Tecla 1</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Haces gemelos de plasma blanco y halo carmesí. Destruye drones en vuelo y derrite blindajes enemigos.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Open World Objectives */}
          <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/60">
            <h4 className="font-bold text-white text-xs uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Wind className="w-4 h-4 text-sky-400" /> Dinámica Sandbox en Metrópolis
            </h4>
            <p className="text-xs text-slate-400">
              Observa el minimapa estilo GTA en la esquina inferior izquierda. Los diamantes de colores señalan emergencias activas en tiempo real: atracos a bancos, incendios en LexCorp, persecuciones y drones hostiles. Al completarlas, aumentas la Esperanza Ciudadana.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-950/80 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold text-slate-900 bg-sky-400 hover:bg-sky-300 rounded-xl transition-colors shadow-lg"
          >
            Entendido, ¡A Volar!
          </button>
        </div>
      </div>
    </div>
  );
};
