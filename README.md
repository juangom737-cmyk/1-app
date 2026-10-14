# Metropolis 3D — Superman Open World Sandbox

Juego de acción y mundo abierto en 3D construido con **React 19**, **TypeScript**, **Three.js** y física de cuerpos rígidos **Rapier 3D (`@dimforge/rapier3d-compat`)**.

## Características Principales

- **Vuelo Supersónico y Espacio Exterior**: Despega desde el asfalto de Metrópolis hasta alcanzar velocidades superiores a Mach 5, atravesando la atmósfera hacia el sistema solar (Tierra, Luna, Marte, Saturno y el Sol) donde la radiación solar recarga tu energía al instante.
- **Combate Aéreo 3D con Lock-On y Air Dash Strike**:
  - Fija objetivos terrestres o aéreos con **Q / Tab** (con indicador de salud y distancia en tiempo real).
  - Ejecuta combos de 4 golpes (**Clic Izquierdo**) con desplazamiento aéreo automático (*Air Dash Strike*) hacia el objetivo fijado y remate descendente (*Meteor Slam*).
- **Física de Destrucción y Lanzamiento de Vehículos (Rapier 3D)**:
  - Presiona **F** cerca de cualquier vehículo o enemigo para levantarlo sobre tus hombros con previsualización de trayectoria parabólica.
  - Lánzalo a casi 300 km/h provocando explosiones en área, cráteres, ondas de choque y escombros físicos.
- **Superpoderes Kriptonianos**:
  - **Visión Térmica (`R` / `1`)**: Haces gemelos de plasma con postprocesado *Unreal Bloom* dinámico.
  - **Aliento Gélido (`E` / `2`)**: Vórtice criogénico que extingue incendios y congela enemigos y vehículos en estatuas de hielo destructibles.
  - **Agarre / Golpe Sísmico (`F` / `3`)**: Levanta vehículos o desata una onda expansiva sísmica.
  - **Visión de Rayos X (`X` / `4`)**: Escáner estructural a través de los rascacielos de Metrópolis.
- **6 Emergencias Dinámicas y Radar Estilo GTA**:
  - Minimapa rotatorio alineado con la dirección de Superman que muestra edificios icónicos (*Daily Planet*, *LexCorp Tower*, *S.T.A.R. Labs*, *Wayne Enterprises*, *Puente Colgante Clinton*), tráfico vehicular, enemigos activos y alertas policiales.
- **Ciclo Atmosférico y Profiler 60 FPS**:
  - Alterna en tiempo real entre **Atardecer Dorado**, **Día Solar** y **Noche Cyberpunk** con la tecla **T**.
  - Cambia entre perfiles gráficos (**Equilibrado Radeon**, **Modo Rendimiento** y **Alta Calidad Ultra**) con **F7** y abre el panel de telemetría 60 FPS (FPS, P95 ms, Draw Calls, Triángulos y cuerpos físicos Rapier) con **F8**.

## Ejecución Local

1. Instala las dependencias:
   ```bash
   npm install
   ```
2. Inicia el servidor de desarrollo:
   ```bash
   npm run dev
   ```
3. Abre `http://localhost:3000` en tu navegador.
