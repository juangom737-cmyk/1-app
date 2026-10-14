import React from 'react';
import { X, Flame, Snowflake, Zap, Compass, Shield, Wind, Cpu, Sun } from 'lucide-react';

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
              BOGOTÁ 3D // MANUAL DE PATRULLA
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
                <span className="text-amber-400 font-medium">Combo 4 Golpes / Air Dash / Lanzar</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/50">
                <span className="font-bold text-white block">Clic Der / Doble W</span>
                <span className="text-sky-300 font-medium">Supersónico Instantáneo (Boom Mach)</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/50">
                <span className="font-bold text-white block">Espacio / Shift</span>
                <span className="text-emerald-300 font-medium">Ascender a Órbita / Picado Rápido</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/50">
                <span className="font-bold text-white block">Tecla R / 1</span>
                <span className="text-rose-400 font-medium">Visión Térmica (Láser de plasma)</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/50">
                <span className="font-bold text-white block">Tecla E / 2</span>
                <span className="text-sky-400 font-medium">Aliento Gélido (Estatuas de hielo)</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/50">
                <span className="font-bold text-white block">Tecla F / 3</span>
                <span className="text-orange-400 font-medium">Agarrar/Lanzar Coche o Golpe Sísmico</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/50">
                <span className="font-bold text-white block">Tecla Q / Tab</span>
                <span className="text-red-400 font-medium">Fijar Blanco 3D (Lock-On Aéreo)</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/50">
                <span className="font-bold text-white block">Tecla T / X (4)</span>
                <span className="text-purple-300 font-medium">Cambiar Hora Solar / Visión Rayos X</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/50">
                <span className="font-bold text-white block">Teclas F7 / F8</span>
                <span className="text-emerald-400 font-medium">Perfil Gráfico / Profiler 60 FPS</span>
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
                    <span className="font-bold text-white">
                      Combate Aéreo Lock-On, Impacto Meteoro y Lanzamiento de Vehículos
                    </span>
                    <span className="text-[11px] text-amber-400 font-mono">Q + Clic Izq / F</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Fija un objetivo con <strong>Q/Tab</strong> y ataca con <strong>Clic Izquierdo</strong> para lanzarte en un <em>Air Dash Strike</em> directo hacia drones o enemigos, rematando el 4.º golpe con un <em>Meteor Slam</em> contra el asfalto. Presiona <strong>F</strong> junto a cualquier coche para levantarlo con trayectoria balística y arrojarlo provocando una explosión en área.
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
                    Vórtice criogénico que extingue incendios en rascacielos y encierra a mercenarios, drones y vehículos de escape en estatuas de hielo sólido que puedes hacer estallar de un puñetazo.
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
                    Haces gemelos de plasma blanco y halo carmesí alineados con la mirada de Superman. Derriba escuadrones de drones y funde blindajes enemigos a larga distancia.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-emerald-950/20 border border-emerald-900/40">
                <div className="p-2 rounded-lg bg-emerald-600/20 text-emerald-400 shrink-0">
                  <Wind className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">
                      Carrera por Muros, Órbita Solar y Ciclo Atmosférico
                    </span>
                    <span className="text-[11px] text-emerald-400 font-mono">W en Fachadas / Espacio / T</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Corre verticalmente por cualquier rascacielos para catapultarte desde la azotea, asciende por encima de los 550m hacia el espacio exterior para recargar tu batería solar al instante, o presiona <strong>T</strong> para alternar entre Atardecer Dorado, Día Solar y Noche Cyberpunk.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Open World & Performance Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/60">
              <h4 className="font-bold text-white text-xs uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Sun className="w-4 h-4 text-amber-400" /> 6 Emergencias Dinámicas
              </h4>
              <p className="text-xs text-slate-400">
                Recorre La Candelaria, la Caracas, El Campín, El Dorado y los Cerros Orientales. El radar distingue el corredor rojo de TransMilenio, los hitos de la ciudad y el objetivo activo. Puedes alternar entre los 6 capítulos desde la tarjeta de misión.
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/60">
              <h4 className="font-bold text-white text-xs uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-sky-400" /> Optimización 60 FPS (F7 / F8)
              </h4>
              <p className="text-xs text-slate-400">
                Pulsa <strong>F8</strong> para abrir el Profiler en vivo (FPS, P95 ms, Draw Calls y cuerpos Rapier 3D) y <strong>F7</strong> para cambiar entre los perfiles Equilibrado, Rendimiento y Ultra. El modo Ultra aumenta la resolución y el detalle de las sombras.
              </p>
            </div>
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
