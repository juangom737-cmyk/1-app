# Bogotá 3D — mejoras de mapa, historia y presentación

Esta entrega transforma el escenario genérico de Metrópolis en una Bogotá estilizada y jugable, conserva los sistemas de vuelo y combate existentes y añade una campaña de seis capítulos.

## Mundo y referencias de Bogotá

- Plaza de Bolívar y Capitolio Nacional: plaza de piedra, pórtico, cúpula y bandera colombiana animada.
- Torre Colpatria: rascacielos del Centro Internacional con bandas rojas y helipuerto.
- Cerros Orientales: relieve facetado, Monserrate, Santuario, Guadalupe y cabina de teleférico.
- Parque Metropolitano Simón Bolívar, Estadio El Campín y Aeropuerto El Dorado.
- Río Bogotá, corredor rojo de TransMilenio y estaciones con cubiertas.
- Buses articulados, taxis amarillos y tráfico urbano en movimiento.

El mapa es una composición inspirada en Bogotá, no un mapa geográfico exacto ni una simulación de tráfico real.

## Campaña: «La noche del apagón»

Los Silentes sustraen un núcleo experimental del Banco de la República. Las seis misiones enlazan el Centro Histórico, la Torre Colpatria, Monserrate, la Caracas, El Campín y una subestación. La tarjeta de misión presenta el contexto, el lugar y el objetivo para que cada encuentro se entienda dentro de la historia.

## Presentación y navegación

- Textura de calles y avenidas sobre el terreno, paleta de atardecer altoandino, antialiasing y niebla más gradual.
- Hitos legibles desde el minimapa y relieve verde al oriente.
- El radar identifica barrios aproximados, cerros, Parque Simón Bolívar, El Dorado y el corredor de TransMilenio.
- Superman inicia sobre la Plaza de Bolívar; la historia arranca dentro del mapa.

## Rendimiento

El perfil Radeon mantiene resolución y sombras moderadas para equipos integrados. Los modos de rendimiento y Ultra siguen disponibles con F7; Ultra aumenta la resolución de render y el mapa de sombras. F8 abre FPS, latencia y contadores de escena.

## Ejecutar localmente

```bash
npm install
npm run dev
```

El escenario usa geometría procedural de Three.js y no necesita descargar paquetes de mapas ni imágenes externas.