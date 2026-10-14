# Metrópolis 3D — Versión Mejorada y Optimizada al 100%

Esta versión integra todas las mejoras de rendimiento (60 FPS), física de destrucción con **Rapier 3D**, combate aéreo tridimensional con **Air Dash Strike**, ciclo atmosférico en tiempo real y telemetría completa en el HUD.

## 1. Correcciones Críticas y Mejoras de Jugabilidad

- **Alineación Real de Golpes y Poderes (`CrimeManager.ts` / `SupermanCharacter.ts`)**:
  - Se corrigió el vector de dirección frontal en `handlePunchHit` (`-Math.sin(rotY), -Math.cos(rotY)`), garantizando que los puñetazos y ondas de impacto golpeen y empujen hacia adelante a los enemigos y objetos urbanos frente a Superman.
  - Se corrigió el anclaje espacial de la **Visión Térmica** y el **Aliento Gélido** en `SupermanCharacter.ts` para que ambos poderes nazcan exactamente desde los ojos y la boca de Superman orientados hacia el frente tanto en tierra como en vuelo horizontal y picado.
  - Se añadió recuperación automática del destello térmico/impacto (`hitFlashTimer`) sobre las mallas de enemigos para evitar que queden blancos permanentemente.
- **Combate Aéreo Lock-On y Air Dash Strike (`CombatSystem.ts`)**:
  - Al fijar un objetivo con **Q / Tab** y atacar con **Clic Izquierdo**, Superman realiza un desplazamiento supersónico (*Air Dash Strike*) directo hacia el enemigo u objetivo aéreo, encadenando hasta 4 golpes y rematando con un *Meteor Slam* contra el asfalto.
  - Si un enemigo fijado cae derrotado, el sistema cambia automáticamente al siguiente objetivo activo de la emergencia.
- **Física de Lanzamiento de Vehículos y Explosiones en Área (`PhysicsEngine.ts` / `CombatSystem.ts`)**:
  - Se mejoró la detección de colisiones de vehículos lanzados con **Rapier 3D** para detectar impactos tanto contra el pavimento como contra fachadas de rascacielos (por desaceleración brusca).
  - Al impactar, el vehículo detona una onda expansiva que daña o destruye enemigos en un radio de 24 metros, hace estallar estatuas de hielo y activa el frenado de emergencia en el tráfico cercano (`triggerTrafficPanic`).
  - Los vehículos retirados del tráfico se reponen automáticamente en las avenidas para mantener la ciudad viva.
- **6 Emergencias Dinámicas en Toda Metrópolis (`CrimeManager.ts`)**:
  - Se amplió el sistema de misiones a 6 emergencias distribuidas por todos los distritos: *Banco Central*, *Torre LexCorp*, *Daily Planet*, *Avenida Centenario*, *Campus S.T.A.R. Labs* y *Puente Colgante Clinton*, con reinicio automático al rejugarlas.

## 2. Mejoras de Interfaz, Radar y Rendimiento (60 FPS)

- **Radar Estilo GTA Sincronizado (`Minimap.tsx`)**:
  - Se conectó el ángulo real de orientación de Superman (`playerRotationY`) al minimapa para que gire suavemente con la cámara.
  - Se añadieron indicadores en tiempo real para los **enemigos activos** (puntos rojos/naranjas y celestes cuando están congelados) además del tráfico y los edificios icónicos.
- **Profiler 60 FPS Interactivo (`PerformanceHUD.tsx` + `F7` / `F8`)**:
  - Se integró el componente `PerformanceHUD` con métricas en vivo de **FPS actuales, promedio y mínimos**, **latencia media y P95 en ms**, **Draw Calls**, **Triángulos** y **cuerpos físicos activos de Rapier 3D**.
  - Permite alternar con clic o con **F7** entre tres perfiles: **Equilibrado Radeon (60 FPS)**, **Modo Rendimiento (Turbo)** y **Alta Calidad Ultra**.
- **Ciclo Atmosférico en Tiempo Real (`Tecla T` / Botón en HUD)**:
  - Permite alternar instantáneamente entre **Atardecer Dorado**, **Día Solar** y **Noche Cyberpunk** (encendiendo los letreros de neón, las ventanas emisivas de los rascacielos y el campo estelar).
- **Controles Táctiles y de Escritorio Completos (`GameHUD.tsx` / `TouchControls.tsx`)**:
  - Se separaron los atajos para evitar conflictos: **Q / Tab** exclusivo para *Lock-On*, **C / G** para alternar modo vuelo/tierra, **F / 3** para agarrar/lanzar o golpe sísmico, y **Shift / Ctrl / Z** para descenso rápido.
  - Se añadieron botones táctiles en móviles para **Golpe**, **Agarrar/Lanzar** y **Fijar Blanco**.
