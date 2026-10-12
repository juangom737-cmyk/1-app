# Metrópolis 3D — Versión optimizada (PC con Radeon integrada)

Esta versión se basa en el ZIP original y mantiene la estructura del proyecto, la ciudad, el protagonista, el vuelo, el combate y los poderes.

## Mejoras implementadas

- Render interno inicial a escala 1.0 (antes hasta 2.0 según la densidad de la pantalla). El número de píxeles procesados puede reducirse hasta 4 veces en pantallas con `devicePixelRatio = 2`.
- Antialiasing MSAA desactivado para reducir carga de GPU en equipos integrados. Puede aumentar un poco el aliasing en bordes.
- Sombras iniciales de 1024 x 1024 (antes 2048 x 2048). Zona de sombra algo más acotada.
- Bloom activado solo mientras se usa la visión térmica; blur radial solo durante el vuelo supersónico. Sin esos poderes, se renderiza directamente, evitando múltiples pasadas de pantalla completa.
- Frecuencia de comprobación LOD de edificios y de actualización React/HUD reducida de aproximadamente 20 actualizaciones de estado por segundo a unas 10 a 60 FPS; la cámara, la física y los controles siguen calculándose por fotograma.
- Reutilización de geometrías y materiales de edificios normales, techos y antenas para reducir objetos GPU redundantes.
- Simulación Rapier en reposo cuando no hay cuerpos dinámicos; el jugador sigue utilizando su sistema de movimiento original.
- Colores estáticos de cielo reutilizados en memoria y proyección de cámara actualizada solo cuando el FOV cambia de manera apreciable.

## Atajos añadidos

**F7:** cambia entre los tres perfiles de gráficos:

1. **Equilibrado** (predeterminado): escala 1.0; sombras 1024.
2. **Rendimiento:** escala 0.8; sombras 512.
3. **Alta calidad:** escala 1.25; sombras 2048.

**F8:** muestra u oculta el panel de diagnóstico con FPS, draw calls, triángulos renderizados y cuerpos físicos activos. El contador se actualiza dos veces por segundo. Los FPS se miden en el navegador mientras corre el juego.

## Cómo utilizar

1. Conserva una copia del proyecto original.
2. Usa los archivos de este ZIP para sustituir los del proyecto. Solo se modificaron:
   - `src/components/Metropolis3DScene.tsx`
   - `src/game/PostProcessingEffects.ts`
   - `src/game/CityBuilder.ts`
   - `src/game/PhysicsEngine.ts`
3. Instala las dependencias con `npm install` y ejecuta con `npm run dev` en un entorno con acceso a npm.
4. Activa F8 y compara los FPS con el proyecto original en la misma posición y resolución. Prueba F7 y utiliza **Rendimiento** si el equipo sigue lento.

## Validación y límites

- Se comprobó que todos los archivos TypeScript/TSX se pueden analizar sintácticamente sin errores.
- **No se pudo ejecutar `npm run build` ni medir FPS** en este entorno porque no estaban instaladas las dependencias y la descarga de npm no se completó. Es necesario validar la compilación y la jugabilidad en tu PC o dentro de AI Studio.
- No se han reemplazado los modelos ni se han añadido mecánicas nuevas.
- Si algún efecto no funciona tras integrar los cambios, conserva el original y revisa el archivo indicado por el error de la consola.
