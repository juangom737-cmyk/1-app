import React, { useState, useCallback } from 'react';
import { PowerType, CityBuilding, TrafficCar, Mission } from './types/game';
import { Metropolis3DScene } from './components/Metropolis3DScene';
import { GameHUD } from './components/GameHUD';
import { Minimap } from './components/Minimap';
import { TouchControls } from './components/TouchControls';
import { InstructionsModal } from './components/InstructionsModal';
import { audioService } from './services/AudioService';
import { Shield, Play } from 'lucide-react';

export default function App() {
  const [gameStarted, setGameStarted] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  // Player & World State from 3D Scene
  const [playerState, setPlayerState] = useState<{
    playerX: number;
    playerZ: number;
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
    citizenDialogue?: string | null;
  }>({
    playerX: 0,
    playerZ: 80,
    altMeters: 120,
    speedKmh: 0,
    mach: 0,
    isFlying: true,
    isSupersonic: false,
    solarEnergy: 98,
    health: 100,
    buildings: [],
    trafficCars: [],
    activeMission: null,
    currentMissionIndex: 0,
    allMissions: [],
    citizenDialogue: null,
  });

  const [activePower, setActivePower] = useState<PowerType | null>('heat-vision');
  const [xrayActive, setXrayActive] = useState<boolean>(false);
  const [hopeLevel, setHopeLevel] = useState<number>(85);

  // External Mobile / HUD controls state
  const [externalMove, setExternalMove] = useState<{ dx: number; dz: number }>({ dx: 0, dz: 0 });
  const [externalAscend, setExternalAscend] = useState<boolean>(false);
  const [externalDescend, setExternalDescend] = useState<boolean>(false);
  const [externalSupersonic, setExternalSupersonic] = useState<boolean>(false);
  const [externalPowerTrigger, setExternalPowerTrigger] = useState<PowerType | null>(null);
  const [toggleFlightTrigger, setToggleFlightTrigger] = useState<number>(0);
  const [missionIndexToSwitch, setMissionIndexToSwitch] = useState<number | null>(null);

  const handleUpdateSceneState = useCallback((state: typeof playerState) => {
    setPlayerState(state);
  }, []);

  const handleMissionCompleted = useCallback((hopeGain: number) => {
    setHopeLevel((prev) => Math.min(100, prev + hopeGain));
  }, []);

  const handleToggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    audioService.setMuted(next);
  };

  const handleSelectPower = (power: PowerType) => {
    if (power === 'x-ray') {
      setXrayActive(!xrayActive);
      return;
    }
    setActivePower(power);
  };

  React.useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyX' || e.code === 'Digit4') {
        setXrayActive((prev) => !prev);
      } else if (e.code === 'Digit1') {
        setActivePower('heat-vision');
      } else if (e.code === 'Digit2') {
        setActivePower('freeze-breath');
      } else if (e.code === 'Digit3') {
        setActivePower('ground-slam');
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const handleStartGame = () => {
    setGameStarted(true);
    audioService.playPoliceDispatch();
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 font-sans select-none">
      {/* 3D WebGL Canvas */}
      <Metropolis3DScene
        onUpdateState={handleUpdateSceneState}
        activePower={activePower}
        xrayActive={xrayActive}
        onMissionCompleted={handleMissionCompleted}
        externalMove={externalMove}
        externalAscend={externalAscend}
        externalDescend={externalDescend}
        externalSupersonic={externalSupersonic}
        externalPowerTrigger={externalPowerTrigger}
        toggleFlightTrigger={toggleFlightTrigger}
        missionIndexToSwitch={missionIndexToSwitch}
        onMissionSwitched={() => setMissionIndexToSwitch(null)}
      />

      {/* Title & Start Screen Overlay */}
      {!gameStarted && (
        <div className="absolute inset-0 z-40 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
          <div className="relative max-w-xl w-full p-8 rounded-3xl bg-slate-900 border border-slate-700/80 shadow-2xl text-center space-y-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-rose-600/20 text-rose-500 border border-rose-500/30 mx-auto shadow-lg shadow-rose-600/30">
              <Shield className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-wider text-white font-hud">
                METROPOLIS 3D
              </h1>
              <p className="text-xs sm:text-sm text-sky-400 font-semibold tracking-wide uppercase">
                Mundo Abierto de Superhéroe · Estilo GTA
              </p>
              <p className="text-sm text-slate-400 max-w-md mx-auto pt-2 leading-relaxed">
                Vuela libremente entre los rascacielos de Metrópolis, rompe la barrera del sonido, despliega visión térmica y aliento gélido, y responde a emergencias dinámicas en toda la ciudad.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 text-left pt-2 text-xs">
              <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/50">
                <span className="font-bold text-white block">Vuelo Supersónico</span>
                <span className="text-slate-400 text-[11px]">Hasta Mach 5 en avenidas</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/50">
                <span className="font-bold text-white block">Radar GTA</span>
                <span className="text-slate-400 text-[11px]">Minimapa con alertas en vivo</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/50">
                <span className="font-bold text-white block">Superpoderes</span>
                <span className="text-slate-400 text-[11px]">Láser, Hielo y Golpe Sísmico</span>
              </div>
            </div>

            <div className="pt-4 flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={handleStartGame}
                className="flex items-center justify-center gap-2 px-8 py-3.5 text-sm font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-2xl transition-all shadow-xl shadow-amber-400/20 hover:scale-[1.02] active:scale-[0.98]"
              >
                <Play className="w-4 h-4 fill-slate-950" />
                <span>Patrullar Metrópolis</span>
              </button>

              <button
                onClick={() => setIsHelpOpen(true)}
                className="px-6 py-3.5 text-sm font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-2xl transition-all border border-slate-700"
              >
                Ver Controles
              </button>
            </div>
          </div>
        </div>
      )}

      {/* In-Game HUD (Desktop & Mobile) */}
      {gameStarted && (
        <>
          <GameHUD
            health={playerState.health}
            maxHealth={100}
            solarEnergy={playerState.solarEnergy}
            speedKmh={playerState.speedKmh}
            mach={playerState.mach}
            isFlying={playerState.isFlying}
            isSupersonic={playerState.isSupersonic}
            activePower={activePower}
            xrayActive={xrayActive}
            activeMission={playerState.activeMission}
            hopeLevel={hopeLevel}
            altMeters={playerState.altMeters}
            isMuted={isMuted}
            onToggleMute={handleToggleMute}
            onOpenHelp={() => setIsHelpOpen(true)}
            onSelectPower={handleSelectPower}
            onSwitchMission={(idx) => setMissionIndexToSwitch(idx)}
            missionList={playerState.allMissions}
            currentMissionIndex={playerState.currentMissionIndex}
            citizenDialogue={playerState.citizenDialogue}
            minimapNode={
              <Minimap
                playerX={playerState.playerX}
                playerZ={playerState.playerZ}
                playerRotationY={0}
                buildings={playerState.buildings}
                activeMission={playerState.activeMission}
                trafficCars={playerState.trafficCars}
                altMeters={playerState.altMeters}
              />
            }
          />

          {/* Virtual Mobile Touch Controls */}
          <TouchControls
            onMove={(dx, dz) => setExternalMove({ dx, dz })}
            onAscend={(active) => setExternalAscend(active)}
            onDescend={(active) => setExternalDescend(active)}
            onSupersonic={(active) => setExternalSupersonic(active)}
            onTriggerPower={(power) => {
              handleSelectPower(power);
              setExternalPowerTrigger(power);
            }}
            onReleasePower={() => setExternalPowerTrigger(null)}
            onToggleFlight={() => setToggleFlightTrigger((prev) => prev + 1)}
            isFlying={playerState.isFlying}
            isSupersonic={playerState.isSupersonic}
            activePower={activePower}
          />
        </>
      )}

      {/* Controls & Lore Help Modal */}
      <InstructionsModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
    </div>
  );
}
