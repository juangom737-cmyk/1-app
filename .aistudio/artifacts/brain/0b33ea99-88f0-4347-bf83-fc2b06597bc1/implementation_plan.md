# Plan de Implementación: Sistema Avanzado de Superhéroe 3D (Física, Combate Aéreo, Vuelo Supersónico y Destrucción)

Este plan detalla la arquitectura técnica e integración de sistemas para transformar el juego existente de Superman en Metrópolis en una experiencia de acción de nueva generación, incorporando física de destrucción con Rapier 3D, combate 3D aéreo y terrestre con agarre y lanzamiento de vehículos, vuelo supersónico cinemático, y optimización de mundo abierto a 60 FPS sin alterar los poderes ni la ciudad actual.

---

## 1. Arquitectura Técnica y Estado Actual del Proyecto

- **Motor de Renderizado**: Three.js (r186) con WebGLRenderer, `PCFSoftShadowMap`, `ACESFilmicToneMapping` y pipeline de postprocesamiento personalizado (Bloom + Hypersonic Motion Blur).
- **Framework y UI**: React 19 + TypeScript + Vite + Tailwind CSS. HUD desacoplado con minimapa interactivo en la esquina superior derecha, velocímetro Mach, barra de energía solar y radar de misiones.
- **Modelo del Héroe**: Rig anatómico completo de 1,95 m con manos de 5 dedos articuladas, rostro 3D con parpadeo orgánico, shaders PBR micro-hex y capa dinámica con física ondulatoria por vértices.
- **Sistemas de Entorno Existentes**: `CityBuilder.ts` (cuadrícula de rascacielos con LOD), `TrafficSystem.ts` (tráfico vehicular con coches congelables), `CrimeManager.ts` (enemigos, estatuas de hielo rompibles) y `AudioService.ts` (audio espacial sintetizado por Web Audio API).

---

## 2. Nuevos Módulos y Mejoras por Área

### A. Vuelo Supersónico Cinemático e Inercia Progresiva
- **Aceleración e Inercia con Curva de Potencia**: Implementar física de empuje vectorial suave con arrastre aerodinámico (`drag`), aceleración progresiva de crucero (0 a 350 km/h) y aceleración hipersónica (Mach 1.2 a Mach 5.5+) al mantener Shift o activar Supersónico.
- **Barreras de Mach y Ondas de Choque**:
  - Transición sonora y visual instantánea con anillo de vapor de Prandtl-Glauert al cruzar Mach 1, Mach 2 y Mach 4.
  - Deformación de FOV dinámico de la cámara (de 60° en reposo a 75° en crucero y 96° en velocidad supersónica).
  - Estelas de condensación atmosférica con partículas tensadas a lo largo de las puntas de la capa y los puños del héroe.
- **Despegues y Aterrizajes con Deformación del Entorno**:
  - Al despegar a máxima potencia desde el suelo: cráter de impacto con textura de asfalto agrietado, onda de choque expansiva que empuja coches cercanos y levanta una nube de polvo volumétrico.
  - *Hero Landing* cinemático en 3 puntos con sacudida de cámara proporcional a la altitud de caída y la velocidad vertical.

### B. Destrucción Física y Cuerpos Rígidos (Rapier 3D)
- **Integración de Rapier 3D (`@dimforge/rapier3d-compat`)**:
  - Inicialización del motor de física WASM multihilo optimizado para Three.js.
  - Sincronización continua de posiciones y cuaterniones de cuerpos rígidos con mallas Three.js.
- **Edificios con Fachadas y Secciones Destructibles**:
  - Rascacielos clave con bloques y cornisas segmentadas pre-fracturadas que reaccionan a colisiones de alta velocidad (Superman o vehículos lanzados).
  - Al recibir impactos superiores a un umbral de energía cinética ($E = \frac{1}{2} m v^2$): fractura procedural en trozos de hormigón con colisionadores Rapier dinámicos.
- **Generación de Escombros y Cráteres**:
  - Sistema de *object pooling* para escombros (máximo de 80 fragmentos activos simultáneos con desvanecimiento alfa gradual a los 5 segundos).
  - Calcomanías (*decals*) de cráteres en pavimentos y muros de edificios en puntos de impacto.

### C. Mecánica de Agarre y Lanzamiento (Tecla 'F' + Trayectoria + Lanzamiento)
- **Detección y Agarre de Proximidad**:
  - Al presionar **F** cerca de un coche de tráfico o enemigo: Superman lo levanta sobre sus hombros con las dos manos articuladas alineadas anatómicamente.
  - El objeto pasa a modo cinemático anclado a los brazos de Superman.
- **Visualizador de Parábola de Trayectoria**:
  - Línea punteada de trayectoria balística luminosa que predice el arco de impacto con la gravedad del motor físico.
- **Lanzamiento con Fuerza Sobrehumana**:
  - Al presionar **Clic Izquierdo** (o soltar F): el objeto es proyectado con un impulso de alta velocidad en la dirección de la retícula de apuntado.
  - Al impactar contra otro coche, enemigo o edificio: explosión cinemática, rotura en esquirlas y daño destructivo masivo.

### D. Combate Aéreo Tridimensional y Fijación de Objetivos (Lock-On)
- **Sistema de Fijación de Objetivos (*Lock-On*)**:
  - Tecla **Q** o **Tab** para fijar la cámara sobre el enemigo o dron criminal más cercano.
  - Retícula holográfica de fijación en el HUD y orientación automática de la cámara.
- **Combate Aéreo 3D**:
  - Desplazamiento rápido hacia el objetivo aéreo (*Air Dash Strike*) al presionar ataque en modo fijado.
  - Encadenamiento de combos en el aire: golpes rápidos (clic izquierdo), remate descendente (*Meteor Slam*) que estrella al enemigo contra el pavimento.
- **IA Enemiga Reactiva y Ragdoll**:
  - Drones de LexCorp y asaltantes con comportamiento de evasión, ataque en formación y esquiva de rayos térmicos.
  - Reacción física de impacto (*ragdoll impulse*): los enemigos salen disparados al recibir puñetazos de superfuerza, rebotando en paredes y coches.

### E. Ciudad Dinámica y Optimización de Rendimiento a 60 FPS
- **Tráfico Reactivo a la Destrucción**:
  - Los vehículos frenan de emergencia, esquivan cráteres y reaccionan ante el aterrizaje de Superman o explosiones cercanas.
- **Simulación Culling & LOD Sectorial**:
  - La física completa de cuerpos rígidos de Rapier 3D solo se simula activamente en un radio de 250 metros alrededor del jugador; los sectores lejanos usan cinemática simplificada.
  - *InstancedMesh* para partículas de escombros y chispas de impacto.
  - Limitador estricto de draw calls para mantener 60 FPS estables.

---

## 3. Plan de Archivos y Modificaciones

1. **`package.json`**:
   - Incorporar `@dimforge/rapier3d-compat` para física 3D avanzada de cuerpos rígidos.
2. **`src/game/PhysicsEngine.ts`** (Nuevo):
   - Inicializador de Rapier 3D, gestión de cuerpos rígidos estáticos (suelo, edificios), cuerpos dinámicos (coches lanzables, escombros) y pooling de fragmentos.
3. **`src/game/DestructionSystem.ts`** (Nuevo):
   - Detección de impacto de alta velocidad, fractura de mallas de edificios, emisión de polvo y calcomanías de cráteres.
4. **`src/game/CombatSystem.ts`** (Nuevo / Integración):
   - Sistema de fijación de objetivos (*Lock-On*), combos terrestres y aéreos, mecánicas de agarre y lanzamiento (tecla F) y trayectoria parabólica.
5. **`src/game/SupermanCharacter.ts`**:
   - Poses de agarre de objetos sobre la cabeza, estelas de vuelo atmosféricas y soporte para animación de lanzamiento.
6. **`src/components/Metropolis3DScene.tsx`**:
   - Integración del bucle de física Rapier en el render loop, manejo de teclas (F para agarre, Q para lock-on), cámara dinámica con FOV elástico y seguimiento de combate.
7. **`src/components/ControlsOverlay.tsx`**:
   - Actualización del panel de controles para reflejar la tecla F (Agarrar/Lanzar) y Q (Fijar Objetivo).

---

## 4. Criterios de Aceptación y Verificación

- La tasa de cuadros por segundo se mantiene fluida y estable (60 FPS) tanto en vuelo como durante destrucciones.
- El jugador puede volar progresivamente hasta superar Mach 1 con estampidos sónicos cinemáticos, cambios de FOV y ondas de choque.
- Presionar **F** cerca de un vehículo lo levanta de inmediato mostrando la trayectoria predictiva; hacer clic lo lanza destruyendo la estructura impactada.
- El combate aéreo permite fijar enemigos con **Q**, volar directamente hacia ellos y ejecutar combos en el aire que los estrellan contra el asfalto.
- Ninguna funcionalidad previa (rayos térmicos, aliento gélido, carreras por muros, minimapa, misiones) se ve alterada o rota.
